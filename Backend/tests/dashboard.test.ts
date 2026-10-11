import { api, cleanup, createUser, startServer, TestUser, joinRoom } from "./helpers";

// The dashboard's cross-room views: "who owes what" for funds, and a month's
// spending by bill section.

let admin: TestUser, bhavya: TestUser, chirag: TestUser;
let roomId: string;

beforeAll(async () => {
  await startServer();
  [admin, bhavya, chirag] = await Promise.all([createUser(), createUser(), createUser()]);
  const room = await api(admin, "POST", "/api/rooms", { name: "Dash flat", type: "roommates" });
  roomId = room.body.data.id;
  await joinRoom(bhavya, room.body.data.inviteCode);
  await joinRoom(chirag, room.body.data.inviteCode);
});
afterAll(cleanup);

describe("fund status summary", () => {
  it("tells each person what they owe, and the collector who owes them", async () => {
    const fund = await api(admin, "POST", `/api/rooms/${roomId}/funds`, { name: "October kitty", amountPerMember: 1500 });
    const base = `/api/rooms/${roomId}/funds/${fund.body.data.id}`;
    await api(admin, "POST", `${base}/contributions`, { memberId: admin.id, amount: 1500 }); // counts at once
    await api(admin, "POST", `${base}/contributions`, { memberId: bhavya.id, amount: 1000 }); // waits for Bhavya
    await api(chirag, "POST", `${base}/contributions`, { memberId: chirag.id, amount: 500 }); // waits for the admin

    const [mine] = (await api(admin, "GET", "/api/funds/summary")).body.data;
    expect(mine).toEqual(
      expect.objectContaining({
        fundName: "October kitty",
        roomName: "Dash flat",
        canManage: true,
        me: { paidPaise: 150000, awaitingPaise: 0, duePaise: 0 },
        toConfirm: 1, // Chirag's own record
        toApprove: 0,
      })
    );
    // Both owe the same, so order between them is by name; compare as a set.
    expect(mine.toCollect).toHaveLength(2);
    expect(mine.toCollect).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: bhavya.id, duePaise: 150000, awaitingPaise: 100000 }),
        expect.objectContaining({ userId: chirag.id, duePaise: 150000, awaitingPaise: 50000 }),
      ])
    );

    const [hers] = (await api(bhavya, "GET", "/api/funds/summary")).body.data;
    expect(hers).toEqual(
      expect.objectContaining({
        canManage: false,
        collector: expect.objectContaining({ id: admin.id }),
        // ₹1,000 recorded but not approved yet, so ₹500 is still due on top.
        me: { paidPaise: 0, awaitingPaise: 100000, duePaise: 50000 },
        toCollect: [],
        toApprove: 1,
      })
    );
  });

  it("is empty for someone in no rooms", async () => {
    const loner = await createUser();
    expect((await api(loner, "GET", "/api/funds/summary")).body.data).toEqual([]);
  });
});

describe("spending by section", () => {
  it("groups a month's expenses by section, with my share", async () => {
    const section = await api(admin, "POST", `/api/rooms/${roomId}/categories`, { name: "Groceries", memberIds: [admin.id, bhavya.id] });
    await api(admin, "POST", `/api/rooms/${roomId}/expenses`, { description: "Rashan", amount: 600, splitType: "equal", categoryId: section.body.data.id });
    await api(admin, "POST", `/api/rooms/${roomId}/expenses`, { description: "Plumber", amount: 300, splitType: "equal" });

    const month = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 7);
    const res = await api(chirag, "GET", `/api/expenses/by-category?month=${month}&roomId=${roomId}`);
    expect(res.body.data).toEqual([
      { category: "Groceries", totalPaise: 60000, mySharePaise: 0, expenseCount: 1 }, // Chirag isn't in Groceries
      { category: null, totalPaise: 30000, mySharePaise: 10000, expenseCount: 1 },
    ]);
  });
});
