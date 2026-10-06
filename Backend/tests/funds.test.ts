import { api, cleanup, createUser, startServer, TestUser } from "./helpers";

// Room fund as an upfront kitty: the collector holds the cash, members'
// self-recorded payments need confirming, and closing settles the leftover.

let admin: TestUser, bhavya: TestUser, chirag: TestUser, latecomer: TestUser;
let roomId: string;
const base = () => `/api/rooms/${roomId}/funds`;

beforeAll(async () => {
  await startServer();
  [admin, bhavya, chirag, latecomer] = await Promise.all([createUser(), createUser(), createUser(), createUser()]);
  const room = await api(admin, "POST", "/api/rooms", { name: "Goa trip", type: "trip" });
  roomId = room.body.data.id;
  const code = room.body.data.inviteCode;
  await api(bhavya, "POST", "/api/rooms/join", { inviteCode: code });
  await api(chirag, "POST", "/api/rooms/join", { inviteCode: code });
});
afterAll(cleanup);

describe("upfront kitty", () => {
  let fundId: string;

  it("starts with the current members; the room admin is the collector by default", async () => {
    const res = await api(admin, "POST", base(), { name: "Goa kitty", amountPerMember: 1500 });
    expect(res.status).toBe(201);
    fundId = res.body.data.id;

    // Someone joining the room afterwards isn't asked for money.
    const room = await api(admin, "GET", `/api/rooms/${roomId}`);
    await api(latecomer, "POST", "/api/rooms/join", { inviteCode: room.body.data.invite_code });

    const fund = await api(admin, "GET", `${base()}/${fundId}`);
    expect(fund.body.data.collector.id).toBe(admin.id);
    expect(fund.body.data.members).toHaveLength(3);
    expect(fund.body.data.expectedPaise).toBe(450000);
    expect(fund.body.data.canManage).toBe(true);
  });

  it("the collector's records count at once; a member's own record waits for confirmation", async () => {
    const byAdmin = await api(admin, "POST", `${base()}/${fundId}/contributions`, { memberId: admin.id, amount: 1500 });
    expect(byAdmin.body.data.confirmed).toBe(true);

    const self = await api(bhavya, "POST", `${base()}/${fundId}/contributions`, { memberId: bhavya.id, amount: 1500 });
    expect(self.status).toBe(201);
    expect(self.body.data.confirmed).toBe(false);

    // Members can't record for each other, and the latecomer isn't in this fund.
    expect((await api(chirag, "POST", `${base()}/${fundId}/contributions`, { memberId: bhavya.id, amount: 1 })).status).toBe(403);
    expect((await api(latecomer, "POST", `${base()}/${fundId}/contributions`, { memberId: latecomer.id, amount: 1 })).status).toBe(400);

    const fund = await api(chirag, "GET", `${base()}/${fundId}`);
    expect(fund.body.data.collectedPaise).toBe(150000); // only the confirmed one
    expect(fund.body.data.awaitingConfirmationPaise).toBe(150000);
    expect(fund.body.data.canManage).toBe(false);

    // Only the collector/admin can confirm.
    expect((await api(chirag, "POST", `${base()}/${fundId}/entries/${self.body.data.id}/confirm`)).status).toBe(403);
    expect((await api(admin, "POST", `${base()}/${fundId}/entries/${self.body.data.id}/confirm`)).status).toBe(200);
    expect((await api(admin, "POST", `${base()}/${fundId}/entries/${self.body.data.id}/confirm`)).status).toBe(409);
  });

  it("the collector can reject a payment that never arrived", async () => {
    const fake = await api(chirag, "POST", `${base()}/${fundId}/contributions`, { memberId: chirag.id, amount: 5000 });
    expect((await api(admin, "DELETE", `${base()}/${fundId}/entries/${fake.body.data.id}`)).status).toBe(204);
  });

  it("unconfirmed money can't be spent", async () => {
    const pending = await api(chirag, "POST", `${base()}/${fundId}/contributions`, { memberId: chirag.id, amount: 1000 });
    // Confirmed so far: ₹3000. ₹3500 is more than the fund really has.
    expect((await api(admin, "POST", `${base()}/${fundId}/spends`, { description: "Villa", amount: 3500 })).status).toBe(400);
    await api(admin, "POST", `${base()}/${fundId}/entries/${pending.body.data.id}/confirm`);
    expect((await api(admin, "POST", `${base()}/${fundId}/spends`, { description: "Villa", amount: 3000 })).status).toBe(201);
  });

  it("closing settles so everyone paid an equal share of what was spent", async () => {
    // Paid: admin ₹1500, Bhavya ₹1500, Chirag ₹1000. Spent ₹3000 -> ₹1000 each.
    expect((await api(bhavya, "GET", `${base()}/${fundId}/close-preview`)).status).toBe(403);
    const preview = await api(admin, "GET", `${base()}/${fundId}/close-preview`);
    expect(preview.body.data.transfers).toEqual([
      expect.objectContaining({ userId: bhavya.id, kind: "refund", amountPaise: 50000 }),
    ]);

    // A payment still waiting for confirmation blocks closing.
    const late = await api(chirag, "POST", `${base()}/${fundId}/contributions`, { memberId: chirag.id, amount: 100 });
    expect((await api(admin, "POST", `${base()}/${fundId}/close`)).status).toBe(409);
    await api(admin, "DELETE", `${base()}/${fundId}/entries/${late.body.data.id}`);

    const closed = await api(admin, "POST", `${base()}/${fundId}/close`);
    expect(closed.status).toBe(200);

    const fund = await api(bhavya, "GET", `${base()}/${fundId}`);
    expect(fund.body.data.status).toBe("closed");
    const refund = fund.body.data.entries.find((e: { kind: string }) => e.kind === "refund");
    expect(refund).toEqual(expect.objectContaining({ member_id: bhavya.id, amount_paise: 50000, confirmed: false }));

    // Closed means read-only, except marking the settlement done.
    expect((await api(admin, "POST", `${base()}/${fundId}/spends`, { description: "x", amount: 1 })).status).toBe(409);
    expect((await api(bhavya, "POST", `${base()}/${fundId}/contributions`, { memberId: bhavya.id, amount: 1 })).status).toBe(409);
    expect((await api(admin, "POST", `${base()}/${fundId}/entries/${refund.id}/confirm`)).status).toBe(200);
  });

  it("a member who paid less than their share owes the collector", async () => {
    const res = await api(admin, "POST", base(), { name: "Week 2", amountPerMember: 1000, participantIds: [admin.id, bhavya.id, chirag.id] });
    const id = res.body.data.id;
    await api(admin, "POST", `${base()}/${id}/contributions`, { memberId: admin.id, amount: 1000 });
    await api(admin, "POST", `${base()}/${id}/contributions`, { memberId: bhavya.id, amount: 1000 });
    await api(admin, "POST", `${base()}/${id}/spends`, { description: "Food", amount: 1500 }); // ₹500 each; Chirag paid 0
    const preview = await api(admin, "GET", `${base()}/${id}/close-preview`);
    // Order follows participant order, which isn't meaningful - compare as a set.
    expect(preview.body.data.transfers).toHaveLength(2);
    expect(preview.body.data.transfers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: bhavya.id, kind: "refund", amountPaise: 50000 }),
        expect.objectContaining({ userId: chirag.id, kind: "collection", amountPaise: 50000 }),
      ])
    );
  });

  it("the collector must be in the fund, and everyone in it must be in the room", async () => {
    const outsider = await createUser();
    expect((await api(admin, "POST", base(), { name: "x", amountPerMember: 1, participantIds: [admin.id, outsider.id] })).status).toBe(400);
    expect((await api(admin, "POST", base(), { name: "x", amountPerMember: 1, participantIds: [admin.id], collectorId: bhavya.id })).status).toBe(400);
  });
});
