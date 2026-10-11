import { api, cleanup, createUser, joinRoom, startServer, TestUser } from "./helpers";

// A room's size comes from its owner's plan: free = 4 people (admin included).
// The database enforces it on both the request and the approval.

let owner: TestUser, superAdmin: TestUser;
let roomId: string, inviteCode: string;
const room = async () => (await api(owner, "GET", `/api/rooms/${roomId}`)).body.data;

beforeAll(async () => {
  await startServer();
  [owner, superAdmin] = await Promise.all([createUser(), createUser({ role: "super_admin" })]);
  const created = await api(owner, "POST", "/api/rooms", { name: "Tiny flat", type: "roommates" });
  roomId = created.body.data.id;
  inviteCode = created.body.data.inviteCode;
});
afterAll(cleanup);

describe("free plan: 4 people per room", () => {
  it("takes three more people, then turns the next one away with a clear message", async () => {
    for (let i = 0; i < 3; i++) expect((await joinRoom(await createUser(), inviteCode)).status).toBe(200);
    expect(await room()).toEqual(expect.objectContaining({ member_count: 4, max_members: 4, plan: "free" }));

    const fifth = await api(await createUser(), "POST", "/api/rooms/join", { inviteCode });
    expect(fifth.status).toBe(409);
    expect(fifth.body.message).toMatch(/This room is full: 4 of 4 people on the free plan/);
  });

  it("requests made while there was room still can't be approved past the limit", async () => {
    const other = await api(owner, "POST", "/api/rooms", { name: "Race flat", type: "roommates" });
    const [a, b, c, d] = await Promise.all([createUser(), createUser(), createUser(), createUser()]);
    const requests = [];
    for (const u of [a, b, c, d]) requests.push((await api(u, "POST", "/api/rooms/join", { inviteCode: other.body.data.inviteCode })).body.data);
    const approve = (r: { id: string; requestId: string }) => api(owner, "POST", `/api/rooms/${r.id}/join-requests/${r.requestId}/approve`);

    // All four at once: exactly three fit (the room row lock serialises them).
    const results = await Promise.all(requests.map(approve));
    expect(results.map((r) => r.status).sort()).toEqual([200, 200, 200, 409]);
    const members = await api(owner, "GET", `/api/rooms/${other.body.data.id}/members`);
    expect(members.body.data).toHaveLength(4);
  });
});

describe("upgrading", () => {
  it("only the super admin can change a plan", async () => {
    expect((await api(owner, "POST", `/api/admin/users/${owner.id}/plan`, { plan: "paid" })).status).toBe(403);
  });

  it("paid lets the room grow; moving back to free keeps everyone but blocks new joins", async () => {
    const up = await api(superAdmin, "POST", `/api/admin/users/${owner.id}/plan`, { plan: "paid" });
    expect(up.status).toBe(200);
    expect(up.body.data).toEqual(expect.objectContaining({ plan: "paid", maxMembersPerRoom: 20 }));
    expect((await api(superAdmin, "POST", `/api/admin/users/${owner.id}/plan`, { plan: "paid" })).status).toBe(409);

    expect((await joinRoom(await createUser(), inviteCode)).status).toBe(200);
    expect(await room()).toEqual(expect.objectContaining({ member_count: 5, max_members: 20, plan: "paid" }));

    await api(superAdmin, "POST", `/api/admin/users/${owner.id}/plan`, { plan: "free" });
    expect(await room()).toEqual(expect.objectContaining({ member_count: 5, max_members: 4 })); // nobody removed
    expect((await api(await createUser(), "POST", "/api/rooms/join", { inviteCode })).status).toBe(409);

    const me = await api(owner, "GET", "/api/users/me");
    expect(me.body.data).toEqual(expect.objectContaining({ plan: "free", max_members_per_room: 4 }));
  });
});
