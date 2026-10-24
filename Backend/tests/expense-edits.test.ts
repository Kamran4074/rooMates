import { adminPool, withUserContext } from "../src/config/db";
import { api, cleanup, createUser, startServer, TestUser, joinRoom } from "./helpers";

// Editing an expense: who may, what it does to balances, what the activity
// feed records, and the database rules behind it.

beforeAll(startServer);
afterAll(cleanup);

// A fresh room per test, so balances don't carry over. `admin` runs it.
async function setup() {
  const [admin, adder, other] = await Promise.all([createUser(), createUser(), createUser()]);
  const room = await api(admin, "POST", "/api/rooms", { name: "Edit test", type: "roommates" });
  const roomId: string = room.body.data.id;
  await joinRoom(adder, room.body.data.inviteCode);
  await joinRoom(other, room.body.data.inviteCode);
  const url = (id = "") => `/api/rooms/${roomId}/expenses${id && `/${id}`}`;
  const add = async (user: TestUser, body: Record<string, unknown>) =>
    (await api(user, "POST", url(), { splitType: "equal", ...body })).body.data.id as string;
  const edit = (user: TestUser, id: string, body: Record<string, unknown>) =>
    api(user, "PUT", url(id), { splitType: "equal", ...body });
  const net = async (id: string) => {
    const b = await api(admin, "GET", `/api/rooms/${roomId}/balances`);
    return b.body.data.balances.find((x: { userId: string }) => x.userId === id).netPaise as number;
  };
  const edits = async (expenseId: string) =>
    (
      await adminPool.query(
        "SELECT actor_id, data FROM activity_log WHERE type = 'expense_edited' AND data->>'expense_id' = $1 ORDER BY created_at",
        [expenseId]
      )
    ).rows;
  return { admin, adder, other, roomId, url, add, edit, net, edits };
}

describe("editing an expense", () => {
  it("changes amount and date, updates balances and logs old -> new", async () => {
    const t = await setup();
    const id = await t.add(t.adder, { description: "Rent", amount: 900, expenseDate: "2026-10-03" });
    expect(await t.net(t.adder.id)).toBe(60000); // paid 900, owes 300

    const res = await t.edit(t.adder, id, { description: "Rent", amount: 1200, expenseDate: "2026-10-05" });
    expect(res.status).toBe(200);
    expect(res.body.data.changed).toBe(true);
    expect(await t.net(t.adder.id)).toBe(80000); // paid 1200, owes 400

    const saved = await api(t.adder, "GET", t.url(id));
    expect(saved.body.data).toEqual(
      expect.objectContaining({ amountPaise: 120000, expenseDate: "2026-10-05", splitType: "equal", canEdit: true })
    );
    expect(saved.body.data.editedAt).toEqual(expect.any(String));

    const [log] = await t.edits(id);
    expect(log.actor_id).toBe(t.adder.id);
    expect(log.data.changes).toEqual({ amount_paise: [90000, 120000], expense_date: ["2026-10-03", "2026-10-05"] });
  });

  it("only whoever added it or the room admin may edit", async () => {
    const t = await setup();
    const id = await t.add(t.adder, { description: "Gas", amount: 300 });
    const other = await t.edit(t.other, id, { description: "Gas", amount: 1 });
    expect(other.status).toBe(403);
    expect((await api(t.other, "GET", t.url(id))).body.data.canEdit).toBe(false);
    expect((await t.edit(t.admin, id, { description: "Gas", amount: 330 })).status).toBe(200);
  });

  it("can change who shares it; a split-only change logs an empty change list", async () => {
    const t = await setup();
    const id = await t.add(t.adder, { description: "Groceries", amount: 300 });
    const res = await t.edit(t.adder, id, { description: "Groceries", amount: 300, participantIds: [t.adder.id, t.admin.id] });
    expect(res.status).toBe(200);
    expect(await t.net(t.other.id)).toBe(0); // no longer shares it
    expect(await t.net(t.admin.id)).toBe(-15000);
    expect((await t.edits(id))[0].data.changes).toEqual({});
  });

  it("follows the same rules as adding", async () => {
    const t = await setup();
    const outsider = await createUser();
    const id = await t.add(t.adder, { description: "WiFi", amount: 600 });
    const badSum = await t.edit(t.adder, id, {
      description: "WiFi",
      amount: 600,
      splitType: "custom",
      splits: [{ userId: t.adder.id, amount: 100 }],
    });
    expect(badSum.status).toBe(400);
    expect((await t.edit(t.adder, id, { description: "WiFi", amount: 600, participantIds: [outsider.id] })).status).toBe(400);
    expect((await t.edit(t.adder, id, { description: "WiFi", amount: 600, expenseDate: "2999-01-01" })).status).toBe(400);
  });

  it("saving without changes writes nothing", async () => {
    const t = await setup();
    const id = await t.add(t.adder, { description: "Milk", amount: 90, expenseDate: "2026-10-01" });
    const before = await api(t.adder, "GET", t.url(id));
    const res = await t.edit(t.adder, id, {
      description: "Milk",
      amount: 90,
      expenseDate: "2026-10-01",
      participantIds: before.body.data.participantIds,
    });
    expect(res.body.data.changed).toBe(false);
    expect(await t.edits(id)).toHaveLength(0);
    expect((await api(t.adder, "GET", t.url(id))).body.data.editedAt).toBeNull();
  });

  it("a deleted expense can't be edited", async () => {
    const t = await setup();
    const id = await t.add(t.adder, { description: "Oops", amount: 50 });
    await api(t.adder, "DELETE", t.url(id));
    expect((await t.edit(t.adder, id, { description: "Oops", amount: 60 })).status).toBe(404);
  });

  it("refuses when someone on it has left the room (their balance was settled)", async () => {
    const t = await setup();
    const id = await t.add(t.admin, { description: "Dinner", amount: 200, participantIds: [t.admin.id, t.other.id] });
    await api(t.other, "POST", `/api/rooms/${t.roomId}/settlements`, { fromUserId: t.other.id, toUserId: t.admin.id, amount: 100 });
    expect((await api(t.admin, "DELETE", `/api/rooms/${t.roomId}/members/${t.other.id}`)).status).toBe(204);

    const res = await t.edit(t.admin, id, { description: "Dinner", amount: 250, participantIds: [t.admin.id, t.adder.id] });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/left the room/);
  });
});

describe("the database rules behind it", () => {
  it("a member can't remove or add shares on someone else's expense directly", async () => {
    const t = await setup();
    // The admin has no share on it, so the insert below can only fail on RLS (not a duplicate key).
    const id = await t.add(t.adder, { description: "Power bill", amount: 300, participantIds: [t.adder.id, t.other.id] });

    const removed = await withUserContext(t.other.id, (client) =>
      client.query("DELETE FROM expense_splits WHERE expense_id = $1", [id])
    );
    expect(removed.rowCount).toBe(0); // RLS: not theirs, not the room admin

    const outsiderShare = withUserContext(t.other.id, (client) =>
      client.query("INSERT INTO expense_splits (expense_id, room_id, user_id, share_paise) VALUES ($1, $2, $3, 1)", [
        id,
        t.roomId,
        t.admin.id,
      ])
    );
    await expect(outsiderShare).rejects.toThrow(/row-level security/);
  });
});
