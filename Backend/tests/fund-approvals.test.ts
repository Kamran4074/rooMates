import { api, cleanup, createUser, startServer, TestUser } from "./helpers";

// Two-sided fund payments: the admin records a member's payment, the member
// approves it (or disputes it), and the history keeps who did what.

let admin: TestUser, bhavya: TestUser, chirag: TestUser;
let roomId: string, fundId: string;
const base = () => `/api/rooms/${roomId}/funds/${fundId}`;
const record = (by: TestUser, memberId: string, amount: number) =>
  api(by, "POST", `${base()}/contributions`, { memberId, amount });
const fund = async () => (await api(admin, "GET", base())).body.data;
const entry = async (id: string) => (await fund()).entries.find((e: { id: string }) => e.id === id);

beforeAll(async () => {
  await startServer();
  [admin, bhavya, chirag] = await Promise.all([createUser(), createUser(), createUser()]);
  const room = await api(admin, "POST", "/api/rooms", { name: "Goa trip", type: "trip" });
  roomId = room.body.data.id;
  await api(bhavya, "POST", "/api/rooms/join", { inviteCode: room.body.data.inviteCode });
  await api(chirag, "POST", "/api/rooms/join", { inviteCode: room.body.data.inviteCode });
  fundId = (await api(admin, "POST", `/api/rooms/${roomId}/funds`, { name: "Kitty", amountPerMember: 1500 })).body.data.id;
});
afterAll(cleanup);

describe("admin records, member approves", () => {
  it("waits for the member, shows up in their approvals, and counts once approved", async () => {
    const res = await record(admin, bhavya.id, 1500);
    expect(res.status).toBe(201);
    expect(res.body.data).toEqual(expect.objectContaining({ confirmed: false, waitingFor: "member" }));
    expect((await fund()).collectedPaise).toBe(0);

    const inbox = await api(bhavya, "GET", "/api/fund-approvals");
    expect(inbox.body.data).toEqual([
      expect.objectContaining({ id: res.body.data.id, amount_paise: 150000, room_name: "Goa trip", fund_name: "Kitty" }),
    ]);
    expect((await api(chirag, "GET", "/api/fund-approvals")).body.data).toEqual([]);

    // Only Bhavya can say "yes, I paid that" - not the admin who recorded it, not Chirag.
    const confirm = (u: TestUser) => api(u, "POST", `${base()}/entries/${res.body.data.id}/confirm`);
    expect((await confirm(admin)).status).toBe(403);
    expect((await confirm(chirag)).status).toBe(403);
    expect((await confirm(bhavya)).status).toBe(200);

    expect((await fund()).collectedPaise).toBe(150000);
    expect(await entry(res.body.data.id)).toEqual(expect.objectContaining({ confirmed: true, confirmed_by_name: expect.any(String) }));
    expect((await api(bhavya, "GET", "/api/fund-approvals")).body.data).toEqual([]);
  });

  it("the admin's own payment counts at once", async () => {
    const res = await record(admin, admin.id, 1500);
    expect(res.body.data).toEqual(expect.objectContaining({ confirmed: true, waitingFor: null }));
  });

  it("a member's own record still waits for the admin, and they can't approve it themselves", async () => {
    const res = await record(chirag, chirag.id, 500);
    expect(res.body.data.waitingFor).toBe("collector");
    expect((await api(chirag, "POST", `${base()}/entries/${res.body.data.id}/confirm`)).status).toBe(403);
    expect((await api(admin, "POST", `${base()}/entries/${res.body.data.id}/confirm`)).status).toBe(200);
  });
});

describe("disputes", () => {
  it("a disputed record stops counting, is kept with the reason, and can't be deleted or approved", async () => {
    const before = await fund();
    const res = await record(admin, chirag.id, 1000);
    const dispute = (u: TestUser, note = "I paid 500, not 1000") =>
      api(u, "POST", `${base()}/entries/${res.body.data.id}/dispute`, { note });

    expect((await dispute(bhavya)).status).toBe(403); // not about her
    expect((await dispute(chirag, "")).status).toBe(400); // needs a reason
    expect((await dispute(chirag)).status).toBe(200);

    const after = await fund();
    expect(after.collectedPaise).toBe(before.collectedPaise);
    expect(after.awaitingConfirmationPaise).toBe(before.awaitingConfirmationPaise); // not "waiting" either
    expect(await entry(res.body.data.id)).toEqual(
      expect.objectContaining({ confirmed: false, dispute_note: "I paid 500, not 1000", disputed_by_name: expect.any(String) })
    );

    expect((await api(admin, "DELETE", `${base()}/entries/${res.body.data.id}`)).status).toBe(409);
    expect((await api(chirag, "POST", `${base()}/entries/${res.body.data.id}/confirm`)).status).toBe(409);
    expect((await dispute(chirag)).status).toBe(409);
    expect((await api(chirag, "GET", "/api/fund-approvals")).body.data).toEqual([]);
  });
});
