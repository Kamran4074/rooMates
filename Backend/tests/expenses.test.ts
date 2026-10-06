import { adminPool } from "../src/config/db";
import { api, cleanup, createUser, startServer, TestUser } from "./helpers";

// Expense payer and date, and the one-admin-per-room rule.

let aman: TestUser, bhavya: TestUser, outsider: TestUser;
let roomId: string;

beforeAll(async () => {
  await startServer();
  [aman, bhavya, outsider] = await Promise.all([createUser(), createUser(), createUser()]);
  const room = await api(aman, "POST", "/api/rooms", { name: "Payer test", type: "roommates" });
  roomId = room.body.data.id;
  await api(bhavya, "POST", "/api/rooms/join", { inviteCode: room.body.data.inviteCode });
});
afterAll(cleanup);

const add = (user: TestUser, body: Record<string, unknown>) =>
  api(user, "POST", `/api/rooms/${roomId}/expenses`, { splitType: "equal", ...body });

describe("who paid and when", () => {
  it("records that someone else paid; balances credit the payer", async () => {
    const res = await add(aman, { description: "Milk (Bhavya paid)", amount: 100, paidBy: bhavya.id });
    expect(res.status).toBe(201);
    expect(res.body.data.paidBy).toBe(bhavya.id);

    const balances = await api(aman, "GET", `/api/rooms/${roomId}/balances`);
    const net = (id: string) => balances.body.data.balances.find((b: { userId: string }) => b.userId === id).netPaise;
    expect(net(bhavya.id)).toBe(5000); // paid 100, owes 50
    expect(net(aman.id)).toBe(-5000);
  });

  it("the payer must be in the room", async () => {
    expect((await add(aman, { description: "x", amount: 10, paidBy: outsider.id })).status).toBe(400);
  });

  it("rejects a date in the future", async () => {
    const res = await add(aman, { description: "x", amount: 10, expenseDate: "2999-01-01" });
    expect(res.status).toBe(400);
    expect(res.body.errors.expenseDate).toBeDefined();
  });

  it("a back-dated expense is filed under its own month, and the list is sorted by that date", async () => {
    await add(aman, { description: "Old electricity bill", amount: 300, expenseDate: "2026-01-15" });

    const jan = await api(aman, "GET", `/api/expenses?month=2026-01&roomId=${roomId}`);
    expect(jan.body.data.map((e: { description: string }) => e.description)).toEqual(["Old electricity bill"]);
    expect(jan.body.data[0].expense_date).toBe("2026-01-15");

    const summary = await api(aman, "GET", `/api/expenses/monthly-summary?roomId=${roomId}`);
    expect(summary.body.data.find((m: { month: string }) => m.month === "2026-01")?.totalPaise).toBe(30000);

    // Added last, but spent earliest -> last in the room list.
    const list = await api(aman, "GET", `/api/rooms/${roomId}/expenses`);
    const items = list.body.data;
    expect(items[items.length - 1].description).toBe("Old electricity bill");
  });
});

describe("one admin per room", () => {
  it("the database refuses a second admin, even bypassing the API", async () => {
    // Owner connection: no RLS, so only the unique index stands in the way.
    await expect(
      adminPool.query("UPDATE room_members SET role = 'admin' WHERE room_id = $1 AND user_id = $2", [roomId, bhavya.id])
    ).rejects.toThrow(/room_members_one_admin/);
  });
});
