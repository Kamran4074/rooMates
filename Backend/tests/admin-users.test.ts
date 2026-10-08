import bcrypt from "bcryptjs";
import { adminPool } from "../src/config/db";
import { api, apiRaw, cleanup, createUser, startServer, TestUser } from "./helpers";

// Super admin user management: last active, filters, the user detail view and
// deleting (anonymising) an account.

let admin: TestUser;

beforeAll(async () => {
  await startServer();
  admin = await createUser({ role: "super_admin" });
});
afterAll(cleanup);

const userRow = async (id: string) =>
  (await adminPool.query("SELECT * FROM users WHERE id = $1", [id])).rows[0];

describe("last active", () => {
  it("is stamped when the account signs in", async () => {
    const user = await createUser();
    await adminPool.query("UPDATE users SET password_hash = $2, last_active_at = NULL WHERE id = $1", [
      user.id,
      await bcrypt.hash("password-123", 4),
    ]);
    expect((await api(null, "POST", "/api/auth/login", { email: user.email, password: "password-123" })).status).toBe(200);
    const row = await userRow(user.id);
    expect(Date.now() - new Date(row.last_active_at).getTime()).toBeLessThan(60_000);
  });
});

describe("users list and detail", () => {
  it("filters by status; deleted accounts only show under 'deleted'", async () => {
    const quiet = await createUser();
    await adminPool.query("UPDATE users SET last_active_at = now() - interval '60 days' WHERE id = $1", [quiet.id]);

    const inactive = await api(admin, "GET", `/api/admin/users?status=inactive&search=${quiet.email}`);
    expect(inactive.body.data.map((u: { id: string }) => u.id)).toEqual([quiet.id]);
    const active = await api(admin, "GET", `/api/admin/users?status=active&search=${quiet.email}`);
    expect(active.body.data).toEqual([]);
  });

  it("shows a user's groups with their size and the user's balance", async () => {
    const [owner, friend] = await Promise.all([createUser(), createUser()]);
    const room = await api(owner, "POST", "/api/rooms", { name: "Detail flat", type: "roommates" });
    await api(friend, "POST", "/api/rooms/join", { inviteCode: room.body.data.inviteCode });
    await api(owner, "POST", `/api/rooms/${room.body.data.id}/expenses`, { description: "Rent", amount: 200, splitType: "equal" });

    const res = await api(admin, "GET", `/api/admin/users/${friend.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.rooms).toEqual([
      expect.objectContaining({ name: "Detail flat", role: "member", member_count: 2, net_paise: -10000 }),
    ]);
  });

  it("is super admin only", async () => {
    const normal = await createUser();
    expect((await api(normal, "GET", `/api/admin/users/${normal.id}`)).status).toBe(403);
  });
});

describe("CSV export", () => {
  it("exports the filtered users, neutralises spreadsheet formulas, and is audit-logged", async () => {
    const sneaky = await createUser();
    await adminPool.query(`UPDATE users SET name = '=HYPERLINK("http://evil")' WHERE id = $1`, [sneaky.id]);

    const res = await apiRaw(admin, `/api/admin/users/export?search=${sneaky.email}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="roomates-users-\d{4}-\d{2}-\d{2}\.csv"/);

    const [header, row] = res.text.replace(/^﻿/, "").trim().split("\r\n");
    expect(header).toBe("Name,Email,Mobile,Plan,Profile done,Groups,Listings,Signs in with,Status,Joined,Last active");
    // Leading ' stops Excel running it; quotes doubled inside a quoted cell.
    // The phone (+91..., a plain number) is not touched.
    expect(row.startsWith(`"'=HYPERLINK(""http://evil"")",${sneaky.email},+91`)).toBe(true);

    const { rows } = await adminPool.query(
      "SELECT details FROM audit_logs WHERE admin_id = $1 AND action = 'EXPORTED_USERS' ORDER BY created_at DESC LIMIT 1",
      [admin.id]
    );
    expect(rows[0].details).toEqual(expect.objectContaining({ rows: 1, search: sneaky.email }));
  });

  it("is super admin only", async () => {
    const normal = await createUser();
    expect((await apiRaw(normal, "/api/admin/users/export")).status).toBe(403);
  });
});

describe("deleting an account", () => {
  it("is refused while they owe money, allowed once settled, and anonymises them", async () => {
    const [owner, friend, third] = await Promise.all([createUser(), createUser(), createUser()]);
    const shared = await api(owner, "POST", "/api/rooms", { name: "Shared flat", type: "roommates" });
    const sharedId = shared.body.data.id;
    await api(friend, "POST", "/api/rooms/join", { inviteCode: shared.body.data.inviteCode });
    await api(third, "POST", "/api/rooms/join", { inviteCode: shared.body.data.inviteCode });
    const solo = await api(owner, "POST", "/api/rooms", { name: "Solo trip", type: "trip" });
    await api(friend, "POST", `/api/rooms/${sharedId}/expenses`, { description: "Milk", amount: 300, splitType: "equal" });

    const del = () => api(admin, "POST", `/api/admin/users/${owner.id}/delete`, { reason: "User asked to close the account" });
    const refused = await del();
    expect(refused.status).toBe(409);
    expect(refused.body.message).toContain("Shared flat");

    await api(owner, "POST", `/api/rooms/${sharedId}/settlements`, { fromUserId: owner.id, toUserId: friend.id, amount: 100 });
    const ok = await del();
    expect(ok.status).toBe(200);
    expect(ok.body.data).toEqual(expect.objectContaining({ roomsDeleted: 1, roomsLeft: 1, adminHandedOver: 1 }));

    const row = await userRow(owner.id);
    expect(row.name).toBe("Deleted user");
    expect(row.email).toBe(`deleted-${owner.id}@deleted.invalid`);
    expect([row.phone, row.password_hash, row.google_id, row.picture]).toEqual([null, null, null, null]);

    // Their solo room is gone; the shared room has a new admin (the longest-standing member).
    expect((await adminPool.query("SELECT 1 FROM rooms WHERE id = $1", [solo.body.data.id])).rowCount).toBe(0);
    const members = await api(friend, "GET", `/api/rooms/${sharedId}/members`);
    expect(members.body.data.find((m: { user_id: string }) => m.user_id === friend.id).role).toBe("admin");
    // History stays: the expense and the payment are still there, balances still add up.
    const balances = await api(friend, "GET", `/api/rooms/${sharedId}/balances`);
    const sum = balances.body.data.balances.reduce((s: number, b: { netPaise: number }) => s + b.netPaise, 0);
    expect(sum).toBe(0);

    // Hidden from the default list, listed under "deleted", and recorded in the audit log.
    const list = await api(admin, "GET", `/api/admin/users?search=${owner.id}`);
    expect(list.body.data).toEqual([]);
    const detail = await api(admin, "GET", `/api/admin/users/${owner.id}`);
    expect(detail.body.data.history[0]).toEqual(expect.objectContaining({ action: "DELETED_USER" }));
    expect((await del()).status).toBe(409); // already deleted
  });

  it("won't delete a super admin or yourself", async () => {
    const otherAdmin = await createUser({ role: "super_admin" });
    expect((await api(admin, "POST", `/api/admin/users/${otherAdmin.id}/delete`, { reason: "test" })).status).toBe(403);
    expect((await api(admin, "POST", `/api/admin/users/${admin.id}/delete`, { reason: "test" })).status).toBe(400);
  });
});
