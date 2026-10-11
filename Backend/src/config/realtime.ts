import { IncomingMessage, Server } from "http";
import { Duplex } from "stream";
import { Client } from "pg";
import { WebSocket, WebSocketServer } from "ws";
import { env } from "./env";
import { logger } from "./logger";
import { adminPool } from "./db";
import { verifyAccessToken } from "../middlewares/authenticate";

// Live updates over WebSocket, at ws(s)://<api>/api/ws on the API's own port.
//
// Where events come from: the activity_log trigger runs pg_notify('room_activity')
// for every new event. One dedicated connection LISTENs; each event is looked
// up once (with names) and sent to the open sockets of that room's members.
// NOTIFY is delivered only on COMMIT, so nobody hears about a change that
// rolled back. With several API instances, each listens and serves its own sockets.
//
// Security:
//  - Origin must be one of CORS_ORIGIN, so another website can't open a socket
//    as a logged-in user (cross-site WebSocket hijacking).
//  - Browsers can't set an Authorization header on a WebSocket, and a token in
//    the URL ends up in logs - so the first message must be
//    {"type":"auth","token":"<access token>"} within AUTH_TIMEOUT_MS.
//  - At most MAX_SOCKETS_PER_USER sockets per user; incoming messages are capped.
//  - Ping every HEARTBEAT_MS; a socket that misses a pong is dropped.

export const WS_PATH = "/api/ws";
const CHANNEL = "room_activity";
const AUTH_TIMEOUT_MS = 5_000;
const HEARTBEAT_MS = 25_000;
export const MAX_SOCKETS_PER_USER = 5;

// Close codes the browser client understands.
export const CLOSE_AUTH_FAILED = 4001;
export const CLOSE_TOO_MANY = 4002;

interface LiveSocket extends WebSocket {
  userId?: string;
  alive?: boolean;
}

const sockets = new Map<string, Set<LiveSocket>>(); // userId -> open sockets
let wss: WebSocketServer | null = null;
let listener: Client | null = null;
let heartbeat: NodeJS.Timeout | null = null;
let stopping = false;

function sendJson(ws: WebSocket, data: unknown) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}

function rejectUpgrade(socket: Duplex, status: string) {
  socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

function onUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer) {
  if (!wss || new URL(req.url ?? "/", "http://x").pathname !== WS_PATH) return rejectUpgrade(socket, "404 Not Found");
  if (!env.CORS_ORIGIN.includes(req.headers.origin ?? "")) return rejectUpgrade(socket, "403 Forbidden");
  wss.handleUpgrade(req, socket, head, (ws) => wss!.emit("connection", ws, req));
}

function register(ws: LiveSocket, userId: string): boolean {
  const mine = sockets.get(userId) ?? new Set<LiveSocket>();
  if (mine.size >= MAX_SOCKETS_PER_USER) return false;
  ws.userId = userId;
  mine.add(ws);
  sockets.set(userId, mine);
  return true;
}

function unregister(ws: LiveSocket) {
  if (!ws.userId) return;
  const mine = sockets.get(ws.userId);
  mine?.delete(ws);
  if (mine && mine.size === 0) sockets.delete(ws.userId);
}

function onConnection(ws: LiveSocket) {
  ws.alive = true;
  ws.on("pong", () => (ws.alive = true));
  const authTimer = setTimeout(() => ws.close(CLOSE_AUTH_FAILED, "auth timeout"), AUTH_TIMEOUT_MS);

  ws.on("message", (raw) => {
    if (ws.userId) return; // the only message a client sends is "auth"
    clearTimeout(authTimer);
    try {
      const msg = JSON.parse(raw.toString()) as { type?: string; token?: string };
      if (msg.type !== "auth" || !msg.token) throw new Error("expected auth");
      const { sub } = verifyAccessToken(msg.token);
      if (!register(ws, sub)) return ws.close(CLOSE_TOO_MANY, `max ${MAX_SOCKETS_PER_USER} tabs`);
      sendJson(ws, { type: "ready" });
    } catch {
      ws.close(CLOSE_AUTH_FAILED, "invalid token");
    }
  });
  ws.on("close", () => {
    clearTimeout(authTimer);
    unregister(ws);
  });
  ws.on("error", () => ws.terminate());
}

// One lookup per event (names included), then fan out to the room's members.
async function deliver(payload: string) {
  if (sockets.size === 0) return;
  let ref: { id: string; room_id: string };
  try {
    ref = JSON.parse(payload);
  } catch {
    return;
  }
  const [{ rows: events }, { rows: members }] = await Promise.all([
    adminPool.query(
      `SELECT a.id, a.type, a.room_id, r.name AS room_name, r.type AS room_type,
              a.actor_id, actor.name AS actor_name, a.subject_id, subject.name AS subject_name,
              a.amount_paise::float8 AS amount_paise, a.data, a.created_at, to_user.name AS to_name
       FROM activity_log a
       JOIN rooms r ON r.id = a.room_id
       LEFT JOIN users actor ON actor.id = a.actor_id
       LEFT JOIN users subject ON subject.id = a.subject_id
       LEFT JOIN users to_user ON to_user.id = (a.data->>'to_user_id')::uuid
       WHERE a.id = $1`,
      [ref.id]
    ),
    adminPool.query<{ user_id: string }>("SELECT user_id FROM room_members WHERE room_id = $1", [ref.room_id]),
  ]);
  const event = events[0];
  if (!event) return;
  // Someone whose join request was declined isn't a member, but should hear about it.
  if (event.type === "join_rejected" && event.subject_id) members.push({ user_id: event.subject_id });
  for (const { user_id } of members) {
    for (const ws of sockets.get(user_id) ?? []) sendJson(ws, { type: "activity", event: { ...event, unread: event.actor_id !== user_id } });
  }
}

async function listen(attempt = 0): Promise<void> {
  if (stopping) return;
  const client = new Client({ connectionString: env.DATABASE_URL });
  const retry = () => setTimeout(() => listen(attempt + 1), Math.min(30_000, 1_000 * 2 ** attempt)).unref();
  client.on("notification", (msg) => {
    if (msg.channel === CHANNEL && msg.payload) {
      deliver(msg.payload).catch((err) => logger.warn("Live update delivery failed", { error: (err as Error).message }));
    }
  });
  // A dropped connection (DB restart, network blip): reconnect with backoff.
  client.on("error", (err) => {
    logger.warn("Live updates listener lost its connection", { error: err.message });
    listener = null;
    client.end().catch(() => undefined);
    retry();
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listener = client;
    logger.info("Live updates listening (WebSocket)");
  } catch (err) {
    logger.warn("Live updates couldn't connect, retrying", { error: (err as Error).message });
    client.end().catch(() => undefined);
    retry();
  }
}

export async function startRealtime(server: Server) {
  stopping = false;
  wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 });
  wss.on("connection", onConnection);
  server.on("upgrade", onUpgrade);
  heartbeat = setInterval(() => {
    for (const ws of wss?.clients ?? []) {
      const live = ws as LiveSocket;
      if (live.alive === false) {
        live.terminate();
        continue;
      }
      live.alive = false;
      live.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();
  await listen();
}

// Graceful shutdown: open sockets never close on their own, so close them, or
// server.close() would wait for them until the forced exit.
export async function stopRealtime(server?: Server) {
  stopping = true;
  if (heartbeat) clearInterval(heartbeat);
  server?.off("upgrade", onUpgrade);
  for (const ws of wss?.clients ?? []) ws.close(1001, "server shutting down");
  wss?.close();
  wss = null;
  sockets.clear();
  await listener?.end().catch(() => undefined);
  listener = null;
}
