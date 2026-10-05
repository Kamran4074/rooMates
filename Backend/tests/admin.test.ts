import { adminPool } from "../src/config/db";
import { sha256 } from "../src/utils/hash";
import { api, cleanup, createUser, startServer, TestUser, validListing } from "./helpers";

let user: TestUser, owner: TestUser, admin: TestUser;

beforeAll(async () => {
  await startServer();
  [user, owner, admin] = await Promise.all([createUser(), createUser(), createUser({ role: "super_admin" })]);
});
afterAll(cleanup);

describe("admin access", () => {
  it("normal users get 403 on every admin route", async () => {
    for (const path of ["/api/admin/stats", "/api/admin/users", "/api/admin/listings", "/api/admin/reports", "/api/admin/rooms"]) {
      expect((await api(user, "GET", path)).status).toBe(403);
    }
    expect((await api(null, "GET", "/api/admin/stats")).status).toBe(401);
  });

  it("the role comes from the database, not the request", async () => {
    const res = await api(user, "GET", "/api/admin/stats?role=super_admin");
    expect(res.status).toBe(403);
  });

  it("a super admin gets the dashboard numbers", async () => {
    const res = await api(admin, "GET", "/api/admin/stats");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(
      expect.objectContaining({ total_users: expect.any(Number), pending_listings: expect.any(Number) })
    );
  });
});

describe("listing moderation", () => {
  it("approve / reject only from pending, and each is audit-logged", async () => {
    const draft = await api(owner, "POST", "/api/listings", validListing());
    const id = draft.body.data.id;

    expect((await api(admin, "POST", `/api/admin/listings/${id}/approve`)).status).toBe(409); // still a draft
    await api(owner, "POST", `/api/listings/${id}/status`, { action: "submit" });

    expect((await api(admin, "POST", `/api/admin/listings/${id}/reject`, {})).status).toBe(400); // reason required
    const rejected = await api(admin, "POST", `/api/admin/listings/${id}/reject`, { reason: "Add real photos" });
    expect(rejected.body.data.status).toBe("rejected");

    const seen = await api(owner, "GET", `/api/listings/${id}`);
    expect(seen.body.data.rejection_reason).toBe("Add real photos");

    const { rows } = await adminPool.query("SELECT action FROM audit_logs WHERE entity_id = $1", [id]);
    expect(rows.map((r) => r.action)).toEqual(["REJECTED_LISTING"]);
  });

  it("removing via a report resolves every open report on that listing", async () => {
    const draft = await api(owner, "POST", "/api/listings", validListing());
    const id = draft.body.data.id;
    await api(owner, "POST", `/api/listings/${id}/status`, { action: "submit" });
    await api(admin, "POST", `/api/admin/listings/${id}/approve`);
    const reporter2 = await createUser();
    await api(user, "POST", `/api/listings/${id}/reports`, { reason: "fake_listing" });
    await api(reporter2, "POST", `/api/listings/${id}/reports`, { reason: "spam" });

    const reports = await api(admin, "GET", "/api/admin/reports?status=open&limit=50");
    const mine = reports.body.data.filter((r: { listing_id: string }) => r.listing_id === id);
    expect(mine).toHaveLength(2);

    await api(admin, "POST", `/api/admin/reports/${mine[0].id}/resolve`, { action: "remove_listing" });
    const { rows } = await adminPool.query(
      "SELECT (SELECT status FROM listings WHERE id = $1) AS listing, bool_and(status = 'resolved') AS all_resolved FROM listing_reports WHERE listing_id = $1",
      [id]
    );
    expect(rows[0]).toEqual({ listing: "removed", all_resolved: true });
    // A removed listing is gone for everyone, and its owner can't revive it.
    expect((await api(user, "GET", `/api/listings/${id}`)).status).toBe(404);
    expect((await api(owner, "PATCH", `/api/listings/${id}`, { rent: 100 })).status).toBe(409);
  });
});

describe("suspending accounts", () => {
  it("revokes sessions and blocks refresh; admins can't be suspended", async () => {
    const victim = await createUser();
    const refreshToken = "test-refresh-" + victim.id;
    await adminPool.query(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')",
      [victim.id, sha256(refreshToken)]
    );

    const res = await api(admin, "POST", `/api/admin/users/${victim.id}/suspend`, { reason: "Spam listings" });
    expect(res.status).toBe(200);
    expect((await api(null, "POST", "/api/auth/refresh", { refreshToken })).status).toBe(401);

    expect((await api(admin, "POST", `/api/admin/users/${admin.id}/suspend`)).status).toBe(400);
    const otherAdmin = await createUser({ role: "super_admin" });
    expect((await api(admin, "POST", `/api/admin/users/${otherAdmin.id}/suspend`)).status).toBe(403);

    // A suspended admin loses admin access immediately (role checked per request).
    await adminPool.query("UPDATE users SET suspended_at = now() WHERE id = $1", [otherAdmin.id]);
    expect((await api(otherAdmin, "GET", "/api/admin/stats")).status).toBe(403);
  });
});

describe("room support view", () => {
  it("a super admin can read any room, read-only", async () => {
    const room = await api(user, "POST", "/api/rooms", { name: "Admin view test", type: "trip" });
    await api(user, "POST", `/api/rooms/${room.body.data.id}/expenses`, { description: "Snacks", amount: 300, splitType: "equal" });

    expect((await api(owner, "GET", `/api/rooms/${room.body.data.id}`)).status).toBe(404); // not a member
    const view = await api(admin, "GET", `/api/admin/rooms/${room.body.data.id}`);
    expect(view.status).toBe(200);
    expect(view.body.data.recent_expenses).toHaveLength(1);
    expect(view.body.data.balances).toHaveLength(1);
  });
});
