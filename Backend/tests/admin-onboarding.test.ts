import { adminPool } from "../src/config/db";
import { api, cleanup, createUser, startServer, TestUser } from "./helpers";

// Onboarding tracker: milestone timestamps (trigger) and each user's stage.

let admin: TestUser;

beforeAll(async () => {
  await startServer();
  admin = await createUser({ role: "super_admin" });
});
afterAll(cleanup);

const track = async (user: TestUser, query = "") => {
  const res = await api(admin, "GET", `/api/admin/onboarding?search=${user.email}${query}`);
  expect(res.status).toBe(200);
  return res.body.data.items as { id: string; stage: string; days_waiting: number | null; email_verified_at: string | null }[];
};

describe("milestone timestamps", () => {
  it("are stamped when the flag turns on and cleared when it turns off", async () => {
    const user = await createUser();
    await adminPool.query("UPDATE users SET email_verified = false WHERE id = $1", [user.id]);
    let row = (await adminPool.query("SELECT email_verified_at FROM users WHERE id = $1", [user.id])).rows[0];
    expect(row.email_verified_at).toBeNull();

    await adminPool.query("UPDATE users SET email_verified = true WHERE id = $1", [user.id]);
    row = (await adminPool.query("SELECT email_verified_at FROM users WHERE id = $1", [user.id])).rows[0];
    expect(Date.now() - new Date(row.email_verified_at).getTime()).toBeLessThan(60_000);
  });
});

describe("stages", () => {
  it("walk from email verification to activated", async () => {
    const [user, friend] = await Promise.all([createUser(), createUser()]);
    await adminPool.query("UPDATE users SET email_verified = false, onboarding_completed = false WHERE id = $1", [user.id]);
    expect((await track(user))[0].stage).toBe("email_verified");

    await adminPool.query("UPDATE users SET email_verified = true WHERE id = $1", [user.id]);
    expect((await track(user))[0].stage).toBe("profile_completed");

    await adminPool.query("UPDATE users SET onboarding_completed = true WHERE id = $1", [user.id]);
    expect((await track(user))[0].stage).toBe("joined_group");

    const room = await api(friend, "POST", "/api/rooms", { name: "Funnel flat", type: "roommates" });
    await api(user, "POST", "/api/rooms/join", { inviteCode: room.body.data.inviteCode });
    expect((await track(user))[0].stage).toBe("first_expense");

    await api(user, "POST", `/api/rooms/${room.body.data.id}/expenses`, { description: "Milk", amount: 60, splitType: "equal" });
    const [done] = await track(user);
    expect(done.stage).toBe("activated");
    expect(done.days_waiting).toBeNull();
  });

  it("'stuck' = waiting 3+ days since their last step; tabs filter by stage", async () => {
    const user = await createUser();
    await adminPool.query(
      `UPDATE users SET created_at = now() - interval '5 days', email_verified_at = now() - interval '5 days',
              onboarding_completed_at = now() - interval '5 days' WHERE id = $1`,
      [user.id]
    );
    const [row] = await track(user, "&filter=stuck");
    expect(row).toEqual(expect.objectContaining({ id: user.id, stage: "joined_group", days_waiting: 5 }));
    expect(await track(user, "&filter=waiting_joined_group")).toHaveLength(1);
    expect(await track(user, "&filter=activated")).toHaveLength(0);
  });

  it("leaves super admins out and returns funnel counts", async () => {
    const res = await api(admin, "GET", `/api/admin/onboarding?search=${admin.email}`);
    expect(res.body.data.items).toEqual([]);
    const c = res.body.data.counts;
    expect(c.signed_up).toBeGreaterThanOrEqual(c.email_verified);
    expect(c.email_verified).toBeGreaterThanOrEqual(c.profile_completed);
  });

  it("is super admin only", async () => {
    const normal = await createUser();
    expect((await api(normal, "GET", "/api/admin/onboarding")).status).toBe(403);
  });
});
