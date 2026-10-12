import { adminPool } from "../src/config/db";
import { expirePlans } from "../src/config/housekeeping";
import { api, cleanup, createUser, startServer, TestUser } from "./helpers";

// Plans: what Basic locks, how a user asks for an upgrade, and how the super
// admin turns a phone call + payment into an active plan that later ends.

let basic: TestUser, superAdmin: TestUser, other: TestUser;
let roomId: string;
const myPlan = async (u: TestUser) => (await api(u, "GET", "/api/plans/me")).body.data;
const startFund = () => api(basic, "POST", `/api/rooms/${roomId}/funds`, { name: "Kitty", amountPerMember: 500 });

beforeAll(async () => {
  await startServer();
  [basic, superAdmin, other] = await Promise.all([
    createUser({ plan: "basic" }),
    createUser({ role: "super_admin" }),
    createUser({ plan: "basic" }),
  ]);
  roomId = (await api(basic, "POST", "/api/rooms", { name: "Basic flat", type: "roommates" })).body.data.id;
});
afterAll(cleanup);

describe("the price list", () => {
  it("is public and has the three plans", async () => {
    const res = await api(null, "GET", "/api/plans");
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { id: string }) => p.id)).toEqual(["basic", "standard", "premium"]);
    expect(res.body.data[1]).toEqual(expect.objectContaining({ name: "Standard", price: { monthly: 4900, yearly: 49000 } }));
  });
});

describe("basic", () => {
  it("splits expenses but locks funds, bill sections and Find a room", async () => {
    expect(await myPlan(basic)).toEqual(
      expect.objectContaining({ plan: "basic", expiresAt: null, features: { roomFund: false, billSections: false, findRoom: false } })
    );
    expect((await api(basic, "POST", `/api/rooms/${roomId}/expenses`, { description: "Milk", amount: 60, splitType: "equal" })).status).toBe(201);

    const fund = await startFund();
    expect(fund.status).toBe(403);
    expect(fund.body.message).toMatch(/Room funds is on the Standard plan and above. The room admin can upgrade/);
    expect((await api(basic, "POST", `/api/rooms/${roomId}/categories`, { name: "Rent", memberIds: [basic.id] })).status).toBe(403);
    const search = await api(basic, "GET", "/api/listings");
    expect(search.status).toBe(403);
    expect(search.body.message).toMatch(/Find a room is on the Standard plan/);
  });
});

describe("upgrade requests", () => {
  it("needs a valid mobile number, allows one waiting request, and can be cancelled", async () => {
    const ask = (body: object) => api(basic, "POST", "/api/plans/upgrade-requests", body);
    expect((await ask({ plan: "standard", billingCycle: "monthly", phone: "12345" })).status).toBe(400);
    expect((await ask({ plan: "basic", billingCycle: "monthly", phone: "9876543210" })).status).toBe(400);

    const first = await ask({ plan: "standard", billingCycle: "monthly", phone: "9876543210" });
    expect(first.status).toBe(201);
    expect(first.body.data).toEqual(expect.objectContaining({ status: "pending", amount_paise: 4900 }));
    expect((await ask({ plan: "premium", billingCycle: "yearly", phone: "9876543210" })).status).toBe(409);

    expect((await api(basic, "POST", `/api/plans/upgrade-requests/${first.body.data.id}/cancel`)).status).toBe(200);
    expect((await api(other, "POST", `/api/plans/upgrade-requests/${first.body.data.id}/cancel`)).status).toBe(404);
  });

  it("only the super admin sees the queue; approving activates the plan for the period paid", async () => {
    const req = await api(basic, "POST", "/api/plans/upgrade-requests", { plan: "premium", billingCycle: "yearly", phone: "9876543210", note: "Call after 6pm" });
    expect(req.body.data.amount_paise).toBe(99000);

    expect((await api(basic, "GET", "/api/admin/upgrade-requests")).status).toBe(403);
    const queue = await api(superAdmin, "GET", "/api/admin/upgrade-requests?status=pending&limit=50");
    expect(queue.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: req.body.data.id, phone: expect.stringContaining("9876543210"), note: "Call after 6pm", current_plan: "basic" })])
    );

    const approve = () => api(superAdmin, "POST", `/api/admin/upgrade-requests/${req.body.data.id}/approve`, { note: "Paid by UPI" });
    const approved = await approve();
    expect(approved.status).toBe(200);
    const months = (new Date(approved.body.data.planExpiresAt).getTime() - Date.now()) / (30.4 * 24 * 3600 * 1000);
    expect(months).toBeGreaterThan(11.5);
    expect(months).toBeLessThan(12.5);
    expect((await approve()).status).toBe(409);

    expect(await myPlan(basic)).toEqual(expect.objectContaining({ plan: "premium", features: { roomFund: true, billSections: true, findRoom: true } }));
    expect((await startFund()).status).toBe(201);
    expect((await api(basic, "GET", "/api/listings")).status).toBe(200);
  });

  it("renewing the same plan early extends it from its current end", async () => {
    const before = new Date((await myPlan(basic)).expiresAt).getTime();
    const req = await api(basic, "POST", "/api/plans/upgrade-requests", { plan: "premium", billingCycle: "monthly", phone: "9876543210" });
    const approved = await api(superAdmin, "POST", `/api/admin/upgrade-requests/${req.body.data.id}/approve`, {});
    const days = (new Date(approved.body.data.planExpiresAt).getTime() - before) / (24 * 3600 * 1000);
    expect(days).toBeGreaterThanOrEqual(28);
    expect(days).toBeLessThanOrEqual(31);
  });

  it("a declined request says why and changes nothing", async () => {
    const req = await api(other, "POST", "/api/plans/upgrade-requests", { plan: "standard", billingCycle: "monthly", phone: "9123456780" });
    expect((await api(superAdmin, "POST", `/api/admin/upgrade-requests/${req.body.data.id}/reject`, { note: "Couldn't reach you" })).status).toBe(200);
    expect(await myPlan(other)).toEqual(
      expect.objectContaining({ plan: "basic", latestRequest: expect.objectContaining({ status: "rejected", admin_note: "Couldn't reach you" }) })
    );
  });
});

describe("when a plan ends", () => {
  it("goes back to basic: new funds are locked, the existing fund is still there", async () => {
    await adminPool.query(
      "UPDATE organizations SET plan_expires_at = now() - interval '1 minute' WHERE id = (SELECT organization_id FROM users WHERE id = $1)",
      [basic.id]
    );
    expect(await expirePlans()).toBeGreaterThanOrEqual(1);
    expect(await myPlan(basic)).toEqual(expect.objectContaining({ plan: "basic", expiresAt: null, limits: expect.objectContaining({ maxMembersPerRoom: 4 }) }));
    expect((await startFund()).status).toBe(403);
    const funds = await api(basic, "GET", `/api/rooms/${roomId}/funds`);
    expect(funds.status).toBe(200);
    expect(funds.body.data).toHaveLength(1);
  });
});

describe("pricing editor (super admin)", () => {
  const standardAsSent = async () => {
    const p = (await api(superAdmin, "GET", "/api/admin/pricing")).body.data.find((x: { id: string }) => x.id === "standard");
    return {
      name: p.name, tagline: p.tagline, priceMonthly: p.price.monthly / 100, priceYearly: p.price.yearly / 100, maxRooms: p.maxRooms,
      maxMembersPerRoom: p.maxMembersPerRoom, maxListings: p.maxListings, unlimited: p.unlimited, features: p.features, support: p.support,
    };
  };

  it("changes prices, limits and features for everyone on the plan; old quotes stay", async () => {
    const original = await standardAsSent();
    const edit = (u: TestUser, plan: string, body: object) => api(u, "PATCH", `/api/admin/pricing/${plan}`, body);
    const onStandard = await createUser({ plan: "standard" });
    const quoted = await api(other, "POST", "/api/plans/upgrade-requests", { plan: "standard", billingCycle: "monthly", phone: "9123456780" });
    try {
      expect((await edit(basic, "standard", original)).status).toBe(403);
      expect((await edit(superAdmin, "basic", { ...original, priceMonthly: 10 })).status).toBe(400);
      expect((await edit(superAdmin, "standard", { ...original, priceMonthly: 0 })).status).toBe(400);

      const saved = await edit(superAdmin, "standard", {
        ...original, priceMonthly: 59, maxMembersPerRoom: 12, features: { ...original.features, findRoom: false },
      });
      expect(saved.status).toBe(200);

      const list = (await api(null, "GET", "/api/plans")).body.data;
      expect(list[1]).toEqual(expect.objectContaining({ price: expect.objectContaining({ monthly: 5900 }), maxMembersPerRoom: 12 }));
      expect((await myPlan(onStandard)).limits.maxMembersPerRoom).toBe(12); // applied to existing accounts
      expect((await api(onStandard, "GET", "/api/listings")).status).toBe(403); // feature moved off the plan
      expect((await myPlan(other)).latestRequest.amount_paise).toBe(4900); // quoted before the change

      const audit = await api(superAdmin, "GET", "/api/admin/audit-logs?limit=5");
      expect(audit.body.data[0]).toEqual(expect.objectContaining({ action: "CHANGED_PRICING" }));
    } finally {
      await edit(superAdmin, "standard", original);
      await api(other, "POST", `/api/plans/upgrade-requests/${quoted.body.data.id}/cancel`);
    }
    expect((await api(null, "GET", "/api/plans")).body.data[1].price.monthly).toBe(4900);
  });
});
