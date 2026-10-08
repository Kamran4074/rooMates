import { Response } from "express";
import { Client } from "pg";
import { env } from "./env";
import { logger } from "./logger";
import { adminPool } from "./db";

// Live updates over Server-Sent Events (SSE).
//
// Why SSE and not WebSockets: updates only flow server -> browser ("something
// changed in your room, refresh"). SSE is plain HTTP - no extra library, works
// through Render/Vercel proxies, and the browser can send the usual
// Authorization header with fetch().
//
// Where events come from: the activity_log trigger runs pg_notify('room_activity')
// for every new event. One dedicated connection LISTENs, and each event goes
// to the open streams of that room's members. NOTIFY is delivered only when the
// writing transaction commits, so nobody hears about a change that rolled back.
// With several API instances, each one listens and serves its own streams.

const CHANNEL = "room_activity";
const HEARTBEAT_MS = 25_000; // under typical proxy idle timeouts
export const MAX_STREAMS_PER_USER = 5;

const streams = new Map<string, Set<Response>>(); // userId -> open streams
let listener: Client | null = null;
let heartbeat: NodeJS.Timeout | null = null;
let stopping = false;

function send(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Registers an open stream; returns false if the user already has too many.
export function addStream(userId: string, res: Response): boolean {
  const mine = streams.get(userId) ?? new Set<Response>();
  if (mine.size >= MAX_STREAMS_PER_USER) return false;
  mine.add(res);
  streams.set(userId, mine);
  res.on("close", () => {
    mine.delete(res);
    if (mine.size === 0) streams.delete(userId);
  });
  send(res, "ready", { at: new Date().toISOString() });
  return true;
}

async function deliver(payload: string) {
  let event: { room_id: string; type: string };
  try {
    event = JSON.parse(payload);
  } catch {
    return;
  }
  if (streams.size === 0) return;
  const { rows } = await adminPool.query<{ user_id: string }>("SELECT user_id FROM room_members WHERE room_id = $1", [
    event.room_id,
  ]);
  for (const { user_id } of rows) {
    for (const res of streams.get(user_id) ?? []) send(res, "activity", event);
  }
}

async function connect(attempt = 0): Promise<void> {
  if (stopping) return;
  const client = new Client({ connectionString: env.DATABASE_URL });
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
    setTimeout(() => connect(attempt + 1), Math.min(30_000, 1_000 * 2 ** attempt)).unref();
  });
  try {
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    listener = client;
    logger.info("Live updates listening");
  } catch (err) {
    logger.warn("Live updates couldn't connect, retrying", { error: (err as Error).message });
    client.end().catch(() => undefined);
    setTimeout(() => connect(attempt + 1), Math.min(30_000, 1_000 * 2 ** attempt)).unref();
  }
}

export async function startRealtime() {
  stopping = false;
  await connect();
  // Comment lines keep idle connections from being cut by proxies.
  heartbeat = setInterval(() => {
    for (const set of streams.values()) for (const res of set) res.write(": ping\n\n");
  }, HEARTBEAT_MS);
  heartbeat.unref();
}

// Graceful shutdown: open streams never finish on their own, so end them, or
// server.close() would wait for them until the forced exit.
export async function stopRealtime() {
  stopping = true;
  if (heartbeat) clearInterval(heartbeat);
  for (const set of streams.values()) for (const res of set) res.end();
  streams.clear();
  await listener?.end().catch(() => undefined);
  listener = null;
}
