import { withUserContext } from "../src/config/db";
import { startRealtime, stopRealtime } from "../src/config/realtime";
import { api, baseUrlOf, cleanup, createUser, startServer, TestUser } from "./helpers";

// Bill sections (who shares which bill) and the activity log / notifications.

let admin: TestUser, bhavya: TestUser, chirag: TestUser;
let roomId: string, inviteCode: string;
const rooms = () => `/api/rooms/${roomId}`;
const net = async (who: TestUser) => {
  const res = await api(admin, "GET", `${rooms()}/balances`);
  return res.body.data.balances.find((b: { userId: string }) => b.userId === who.id).netPaise as number;
};

beforeAll(async () => {
  await startServer();
  [admin, bhavya, chirag] = await Promise.all([createUser(), createUser(), createUser()]);
  const room = await api(admin, "POST", "/api/rooms", { name: "Flat 3B", type: "roommates" });
  roomId = room.body.data.id;
  inviteCode = room.body.data.inviteCode;
  await api(bhavya, "POST", "/api/rooms/join", { inviteCode });
  await api(chirag, "POST", "/api/rooms/join", { inviteCode });
});
afterAll(cleanup);

describe("sections", () => {
  let groceries: string;

  it("only the room admin creates them; names are unique per room", async () => {
    const body = { name: "Groceries", memberIds: [admin.id, bhavya.id] }; // Chirag is home this month
    expect((await api(bhavya, "POST", `${rooms()}/categories`, body)).status).toBe(403);
    const res = await api(admin, "POST", `${rooms()}/categories`, body);
    expect(res.status).toBe(201);
    groceries = res.body.data.id;
    expect((await api(admin, "POST", `${rooms()}/categories`, { ...body, name: "groceries" })).status).toBe(409);

    const outsider = await createUser();
    expect((await api(admin, "POST", `${rooms()}/categories`, { name: "WiFi", memberIds: [outsider.id] })).status).toBe(400);
    // Everyone in the room can see them.
    const list = await api(chirag, "GET", `${rooms()}/categories`);
    expect(list.body.data).toEqual([expect.objectContaining({ name: "Groceries", member_ids: expect.arrayContaining([admin.id, bhavya.id]) })]);
  });

  it("an expense in a section is split only between its people; one expense can override that", async () => {
    await api(admin, "POST", `${rooms()}/expenses`, { description: "Rashan", amount: 600, splitType: "equal", categoryId: groceries });
    expect(await net(chirag)).toBe(0); // not in Groceries
    expect(await net(bhavya)).toBe(-30000);

    // This once, all three share it.
    await api(admin, "POST", `${rooms()}/expenses`, {
      description: "Party snacks", amount: 300, splitType: "equal", categoryId: groceries,
      participantIds: [admin.id, bhavya.id, chirag.id],
    });
    expect(await net(chirag)).toBe(-10000);

    const list = await api(admin, "GET", `${rooms()}/expenses`);
    expect(list.body.data[0]).toEqual(expect.objectContaining({ category_name: "Groceries" }));
  });

  it("new members join every section; removed members leave them", async () => {
    const dev = await createUser();
    await api(dev, "POST", "/api/rooms/join", { inviteCode: (await api(admin, "GET", rooms())).body.data.invite_code });
    let section = (await api(admin, "GET", `${rooms()}/categories`)).body.data[0];
    expect(section.member_ids).toContain(dev.id);

    await api(admin, "DELETE", `${rooms()}/members/${dev.id}`);
    section = (await api(admin, "GET", `${rooms()}/categories`)).body.data[0];
    expect(section.member_ids).not.toContain(dev.id);
  });

  it("the admin can change who's in a section, rename it, or delete it", async () => {
    const res = await api(admin, "PATCH", `${rooms()}/categories/${groceries}`, { name: "Rashan", memberIds: [admin.id, bhavya.id, chirag.id] });
    expect(res.body.data).toEqual(expect.objectContaining({ name: "Rashan", member_ids: expect.arrayContaining([chirag.id]) }));
    expect((await api(admin, "DELETE", `${rooms()}/categories/${groceries}`)).status).toBe(204);
    // Old expenses keep their splits; they just lose the label.
    const list = await api(admin, "GET", `${rooms()}/expenses`);
    expect(list.body.data.every((e: { category_name: string | null }) => e.category_name === null)).toBe(true);
    expect(await net(chirag)).toBe(-10000);
  });
});

describe("activity log", () => {
  const feed = async (u: TestUser) => (await api(u, "GET", `/api/notifications?roomId=${roomId}&limit=50`)).body.data;
  const unread = async (u: TestUser) => (await api(u, "GET", "/api/notifications/unread-count")).body.data.count as number;

  it("records who did what; it's unread for everyone except whoever did it", async () => {
    await api(bhavya, "POST", "/api/notifications/seen");
    await api(admin, "POST", "/api/notifications/seen");
    await api(admin, "POST", `${rooms()}/expenses`, { description: "Gas cylinder", amount: 900, splitType: "equal" });

    const [latest] = await feed(bhavya);
    expect(latest).toEqual(expect.objectContaining({ type: "expense_added", actor_id: admin.id, amount_paise: 90000, unread: true }));
    expect(latest.data.description).toBe("Gas cylinder");
    expect(await unread(bhavya)).toBe(1);
    expect(await unread(admin)).toBe(0); // their own action

    await api(bhavya, "POST", "/api/notifications/seen");
    expect(await unread(bhavya)).toBe(0);
  });

  it("logs fund payments, approvals and disputes - the proof trail", async () => {
    const fund = await api(admin, "POST", `${rooms()}/funds`, { name: "Kitty", amountPerMember: 1500 });
    const base = `${rooms()}/funds/${fund.body.data.id}`;
    const forBhavya = await api(admin, "POST", `${base}/contributions`, { memberId: bhavya.id, amount: 1500 });
    await api(bhavya, "POST", `${base}/entries/${forBhavya.body.data.id}/confirm`);
    const forChirag = await api(admin, "POST", `${base}/contributions`, { memberId: chirag.id, amount: 1500 });
    await api(chirag, "POST", `${base}/entries/${forChirag.body.data.id}/dispute`, { note: "Paid 1000 only" });

    const types = (await feed(admin)).map((e: { type: string }) => e.type);
    expect(types).toEqual(expect.arrayContaining(["fund_opened", "fund_payment_recorded", "fund_payment_approved", "fund_payment_disputed"]));
    const disputed = (await feed(admin)).find((e: { type: string }) => e.type === "fund_payment_disputed");
    expect(disputed).toEqual(expect.objectContaining({ actor_id: chirag.id, subject_id: chirag.id, amount_paise: 150000 }));
    expect(disputed.data.note).toBe("Paid 1000 only");
  });

  it("is pushed live to the room's members over the event stream", async () => {
    await startRealtime();
    try {
      const controller = new AbortController();
      const res = await fetch(`${baseUrlOf()}/api/notifications/stream`, {
        headers: { Authorization: `Bearer ${bhavya.token}` },
        signal: controller.signal,
      });
      expect(res.headers.get("content-type")).toContain("text/event-stream");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let text = "";
      const read = async (until: (t: string) => boolean) => {
        const deadline = Date.now() + 8000;
        while (!until(text) && Date.now() < deadline) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value);
        }
      };
      await read((t) => t.includes("event: ready"));
      await new Promise((r) => setTimeout(r, 300)); // LISTEN is set up
      await api(admin, "POST", `${rooms()}/expenses`, { description: "Milk", amount: 60, splitType: "equal" });
      await read((t) => t.includes("event: activity"));
      expect(text).toContain("event: activity");
      expect(text).toContain(`"room_id":"${roomId}"`);
      expect(text).toContain(`"type":"expense_added"`);
      controller.abort();
    } finally {
      await stopRealtime();
    }
  });

  it("can't be written or edited by the app, and outsiders can't read it", async () => {
    await expect(
      withUserContext(admin.id, (client) =>
        client.query("INSERT INTO activity_log (room_id, type) VALUES ($1, 'fake')", [roomId])
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      withUserContext(admin.id, (client) => client.query("DELETE FROM activity_log WHERE room_id = $1", [roomId]))
    ).rejects.toThrow(/permission denied/);

    const outsider = await createUser();
    expect(await feed(outsider)).toEqual([]);
  });
});
