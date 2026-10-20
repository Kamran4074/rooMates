import bcrypt from "bcryptjs";
import { adminPool } from "../src/config/db";
import { api, cleanup, createUser, joinRoom, startServer } from "./helpers";

// "Delete account" from Settings. The anonymising itself is shared with the
// super admin's delete (covered in admin-users.test.ts); these cover the
// checks in front of it.

beforeAll(startServer);
afterAll(cleanup);

const password = "my old password";

async function userWithPassword() {
  const u = await createUser();
  await adminPool.query("UPDATE users SET password_hash = $2 WHERE id = $1", [u.id, await bcrypt.hash(password, 4)]);
  return u;
}

describe("deleting your own account", () => {
  it("needs DELETE typed and the right password", async () => {
    const u = await userWithPassword();
    expect((await api(u, "POST", "/api/users/me/delete", { password })).status).toBe(400);
    const wrong = await api(u, "POST", "/api/users/me/delete", { confirm: "DELETE", password: "guess" });
    expect(wrong.status).toBe(400);
    expect(wrong.body.message).toContain("password");
    expect((await api(u, "POST", "/api/users/me/delete", { confirm: "DELETE" })).status).toBe(400);
    expect((await adminPool.query("SELECT deleted_at FROM users WHERE id = $1", [u.id])).rows[0].deleted_at).toBeNull();
  });

  it("is refused while you have money to settle", async () => {
    const [u, friend] = await Promise.all([userWithPassword(), createUser()]);
    const room = await api(u, "POST", "/api/rooms", { name: "Flat 4B", type: "roommates" });
    await joinRoom(friend, room.body.data.inviteCode);
    await api(friend, "POST", `/api/rooms/${room.body.data.id}/expenses`, { description: "Gas", amount: 200, splitType: "equal" });

    const res = await api(u, "POST", "/api/users/me/delete", { confirm: "DELETE", password });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/^You still have money to settle in: Flat 4B/);
  });

  it("anonymises the account, signs it out everywhere and logs it", async () => {
    const u = await userWithPassword();
    await adminPool.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [u.id, "test-hash-" + u.id]
    );

    const res = await api(u, "POST", "/api/users/me/delete", { confirm: "DELETE", password });
    expect(res.status).toBe(200);

    const row = (await adminPool.query("SELECT * FROM users WHERE id = $1", [u.id])).rows[0];
    expect(row.name).toBe("Deleted user");
    expect(row.deleted_at).not.toBeNull();
    expect([row.phone, row.password_hash]).toEqual([null, null]);
    const live = await adminPool.query("SELECT 1 FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL", [u.id]);
    expect(live.rowCount).toBe(0);
    const log = await adminPool.query("SELECT admin_id FROM audit_logs WHERE entity_id = $1 AND action = 'DELETED_OWN_ACCOUNT'", [u.id]);
    expect(log.rows[0].admin_id).toBe(u.id);

    // A second attempt (e.g. a double click) doesn't succeed again.
    expect((await api(u, "POST", "/api/users/me/delete", { confirm: "DELETE", password })).status).not.toBe(200);
  });

  it("a Google-only account (no password) confirms with DELETE alone", async () => {
    const u = await createUser();
    await adminPool.query("UPDATE users SET password_hash = NULL WHERE id = $1", [u.id]);
    expect((await api(u, "POST", "/api/users/me/delete", { confirm: "DELETE" })).status).toBe(200);
  });
});
