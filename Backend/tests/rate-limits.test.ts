import { WebSocket } from "ws";
import { env } from "../src/config/env";
import { HANDSHAKES_PER_MINUTE, startRealtime, stopRealtime } from "../src/config/realtime";
import { api, baseUrlOf, cleanup, createUser, httpServer, startServer, TestUser } from "./helpers";

// Rate limits: counted per signed-in user (not per IP, so flatmates on one
// WiFi don't share a budget), on top of the per-IP ones for sign-in.

let owner: TestUser, flatmate: TestUser;
let roomId: string;

beforeAll(async () => {
  await startServer();
  startRealtime(httpServer());
  [owner, flatmate] = await Promise.all([createUser(), createUser()]);
  roomId = (await api(owner, "POST", "/api/rooms", { name: "Limits flat", type: "roommates" })).body.data.id;
});
afterAll(async () => {
  await stopRealtime(httpServer());
  await cleanup();
});

describe("per user", () => {
  it("caps join requests at 10 an hour", async () => {
    const statuses = [];
    for (let i = 0; i < 11; i++) statuses.push((await api(flatmate, "POST", "/api/rooms/join", { inviteCode: "NOSUCHCD" })).status);
    expect(statuses.slice(0, 10).every((s) => s === 404)).toBe(true); // wrong code, but counted
    expect(statuses[10]).toBe(429);
  });

  it("caps changes at 60 a minute, says when to retry, and doesn't touch reads or other users", async () => {
    const add = (u: TestUser) => api(u, "POST", `/api/rooms/${roomId}/expenses`, { description: "Chai", amount: 10, splitType: "equal" });
    // Creating the room in beforeAll was write #1, so 59 more fit this minute.
    const results = await Promise.all(Array.from({ length: 61 }, () => add(owner)));
    const statuses = results.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(59);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
    const limited = results.find((r) => r.status === 429)!;
    expect(limited.body.message).toMatch(/too fast/);

    expect((await api(owner, "GET", `/api/rooms/${roomId}`)).status).toBe(200); // reading still works
    expect((await api(flatmate, "POST", "/api/rooms", { name: "Own flat", type: "roommates" })).status).toBe(201); // separate budget
  });
});

describe("live updates", () => {
  it("turns away a flood of WebSocket handshakes from one IP", async () => {
    const statusOf = () =>
      new Promise<number>((resolve) => {
        const ws = new WebSocket(`${baseUrlOf().replace("http", "ws")}/api/ws`, { headers: { Origin: env.CORS_ORIGIN[0] } });
        ws.once("unexpected-response", (_req, res) => resolve(res.statusCode ?? 0));
        ws.once("open", () => {
          ws.close();
          resolve(101);
        });
      });
    const statuses = [];
    for (let i = 0; i <= HANDSHAKES_PER_MINUTE; i++) statuses.push(await statusOf());
    expect(statuses.slice(0, HANDSHAKES_PER_MINUTE).every((s) => s === 101)).toBe(true);
    expect(statuses[HANDSHAKES_PER_MINUTE]).toBe(429);
  });
});
