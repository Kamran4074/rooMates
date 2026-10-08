import crypto from "crypto";
import { withUserContext } from "../src/config/db";
import { seedSuperAdmin } from "../src/config/superAdminSeed";
import { api, cleanup, createUser, startServer, trackUserByEmail, TestUser } from "./helpers";

// Settle-up payments, soft-deleted expenses, the shared room_ledger balances,
// and the env-driven super admin seed.

let admin: TestUser, aman: TestUser, bhavya: TestUser;
let roomId: string;

beforeAll(async () => {
  await startServer();
  [admin, aman, bhavya] = await Promise.all([createUser(), createUser(), createUser()]);
  const room = await api(admin, "POST", "/api/rooms", { name: "Ledger flat", type: "roommates" });
  roomId = room.body.data.id;
  await api(aman, "POST", "/api/rooms/join", { inviteCode: room.body.data.inviteCode });
  await api(bhavya, "POST", "/api/rooms/join", { inviteCode: room.body.data.inviteCode });
});
afterAll(cleanup);

const net = async (user: TestUser, who: TestUser) => {
  const res = await api(user, "GET", `/api/rooms/${roomId}/balances`);
  return res.body.data.balances.find((b: { userId: string }) => b.userId === who.id).netPaise as number;
};
const addExpense = (user: TestUser, amount: number, description = "Groceries") =>
  api(user, "POST", `/api/rooms/${roomId}/expenses`, { description, amount, splitType: "equal" });
const pay = (user: TestUser, from: TestUser, to: TestUser, amount: number) =>
  api(user, "POST", `/api/rooms/${roomId}/settlements`, { fromUserId: from.id, toUserId: to.id, amount });

describe("settle-up payments", () => {
  it("recording a payment moves balances, and the plan empties once everyone is square", async () => {
    await addExpense(admin, 300); // admin +200, aman -100, bhavya -100
    expect(await net(aman, aman)).toBe(-10000);

    expect((await pay(aman, aman, admin, 100)).status).toBe(201);
    expect((await pay(bhavya, bhavya, admin, 100)).status).toBe(201);

    const res = await api(aman, "GET", `/api/rooms/${roomId}/balances`);
    expect(res.body.data.balances.every((b: { netPaise: number }) => b.netPaise === 0)).toBe(true);
    expect(res.body.data.settlements).toEqual([]);

    const list = await api(aman, "GET", `/api/rooms/${roomId}/settlements`);
    expect(list.body.data).toHaveLength(2);
    expect(list.body.pagination.total).toBe(2);
  });

  it("only the two people involved or the room admin can record a payment", async () => {
    // bhavya records "aman paid admin": not hers to record.
    expect((await pay(bhavya, aman, admin, 10)).status).toBe(403);
    // The room admin may record anyone's.
    const byAdmin = await pay(admin, aman, bhavya, 10);
    expect(byAdmin.status).toBe(201);
    await api(admin, "DELETE", `/api/rooms/${roomId}/settlements/${byAdmin.body.data.id}`);
  });

  it("rejects paying yourself and paying someone outside the room", async () => {
    expect((await pay(aman, aman, aman, 10)).status).toBe(400);
    const outsider = await createUser();
    expect((await pay(aman, aman, outsider, 10)).status).toBe(400);
  });

  it("deleting a payment puts the debt back", async () => {
    const res = await pay(aman, aman, bhavya, 50);
    expect(await net(aman, aman)).toBe(5000);
    // Someone else (not admin, not the recorder) can't delete it.
    expect((await api(bhavya, "DELETE", `/api/rooms/${roomId}/settlements/${res.body.data.id}`)).status).toBe(403);
    expect((await api(aman, "DELETE", `/api/rooms/${roomId}/settlements/${res.body.data.id}`)).status).toBe(204);
    expect(await net(aman, aman)).toBe(0);
  });
});

describe("deleting expenses (soft delete)", () => {
  it("whoever added it can delete it; it leaves lists, totals, balances and monthly views", async () => {
    const before = await api(aman, "GET", `/api/rooms/${roomId}`);
    const expense = await addExpense(aman, 90, "Wrong entry");
    const id = expense.body.data.id;
    expect(await net(aman, aman)).toBe(6000);

    expect((await api(bhavya, "DELETE", `/api/rooms/${roomId}/expenses/${id}`)).status).toBe(403);
    expect((await api(aman, "DELETE", `/api/rooms/${roomId}/expenses/${id}`)).status).toBe(204);
    expect((await api(aman, "DELETE", `/api/rooms/${roomId}/expenses/${id}`)).status).toBe(404);

    expect(await net(aman, aman)).toBe(0);
    const list = await api(aman, "GET", `/api/rooms/${roomId}/expenses`);
    expect(list.body.data.some((e: { id: string }) => e.id === id)).toBe(false);
    const after = await api(aman, "GET", `/api/rooms/${roomId}`);
    expect(after.body.data.total_spent_paise).toBe(before.body.data.total_spent_paise);
    const rooms = await api(aman, "GET", "/api/rooms");
    expect(rooms.body.data.find((r: { id: string }) => r.id === roomId).my_net_paise).toBe(0);
  });

  it("the room admin can delete anyone's expense", async () => {
    const expense = await addExpense(bhavya, 30);
    expect((await api(admin, "DELETE", `/api/rooms/${roomId}/expenses/${expense.body.data.id}`)).status).toBe(204);
  });

  it("the database refuses a member soft-deleting someone else's expense directly", async () => {
    const expense = await addExpense(admin, 30);
    const id = expense.body.data.id;
    const updated = await withUserContext(bhavya.id, (client) =>
      client.query("UPDATE expenses SET deleted_at = now(), deleted_by = $2 WHERE id = $1", [id, bhavya.id])
    );
    expect(updated.rowCount).toBe(0); // RLS: not hers, not the room admin
    await api(admin, "DELETE", `/api/rooms/${roomId}/expenses/${id}`);
  });
});

describe("removing a member uses the same ledger", () => {
  it("is blocked while they owe, allowed once a payment squares them", async () => {
    await addExpense(admin, 300); // aman and bhavya each owe 100
    const remove = () => api(admin, "DELETE", `/api/rooms/${roomId}/members/${bhavya.id}`);
    expect((await remove()).status).toBe(409);
    await pay(bhavya, bhavya, admin, 100);
    expect((await remove()).status).toBe(204);
  });
});

describe("super admin seed", () => {
  const email = `seed-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const login = (password: string) => api(null, "POST", "/api/auth/login", { email, password });

  it("creates the account, then does nothing on the next start", async () => {
    expect(await seedSuperAdmin({ email, password: "first-password-123", name: "Seed Admin" })).toBe("created");
    await trackUserByEmail(email);
    expect(await seedSuperAdmin({ email, password: "first-password-123", name: "Seed Admin" })).toBe("unchanged");

    const res = await login("first-password-123");
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe("super_admin");
    expect(res.body.data.user.onboardingCompleted).toBe(true); // no phone/room onboarding for the operator
  });

  it("a new password in the env replaces the old one and signs the account out", async () => {
    const session = await login("first-password-123");
    expect(await seedSuperAdmin({ email, password: "second-password-456", name: "Seed Admin" })).toBe("updated");

    expect((await login("first-password-123")).status).toBe(401);
    expect((await login("second-password-456")).status).toBe(200);
    const refresh = await api(null, "POST", "/api/auth/refresh", { refreshToken: session.body.data.refreshToken });
    expect(refresh.status).toBe(401);
  });

  it("skips a short password or a half-filled config instead of failing", async () => {
    expect(await seedSuperAdmin({ email, password: "short", name: "x" })).toBe("skipped");
    expect(await seedSuperAdmin({ email, password: undefined, name: "x" })).toBe("skipped");
    expect(await seedSuperAdmin({ email: undefined, password: undefined, name: "x" })).toBe("skipped");
  });
});
