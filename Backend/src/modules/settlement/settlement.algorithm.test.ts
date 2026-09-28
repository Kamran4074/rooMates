import { simplifyDebts, splitEqually, Balance } from "./settlement.algorithm";

function netByUser(transactions: ReturnType<typeof simplifyDebts>) {
  const net: Record<string, number> = {};
  for (const t of transactions) {
    net[t.fromUserId] = (net[t.fromUserId] ?? 0) - t.amountPaise;
    net[t.toUserId] = (net[t.toUserId] ?? 0) + t.amountPaise;
  }
  return net;
}

describe("simplifyDebts", () => {
  it("returns no transactions when everyone is already settled", () => {
    const balances: Balance[] = [
      { userId: "a", netPaise: 0 },
      { userId: "b", netPaise: 0 },
    ];
    expect(simplifyDebts(balances)).toEqual([]);
  });

  it("settles a simple two-person case in one transaction", () => {
    const balances: Balance[] = [
      { userId: "a", netPaise: -50000 },
      { userId: "b", netPaise: 50000 },
    ];
    const result = simplifyDebts(balances);
    expect(result).toEqual([{ fromUserId: "a", toUserId: "b", amountPaise: 50000 }]);
  });

  // Real numbers from the project owner's own roommate group: paid 1150,
  // 1390, 1765 rupees over the month (amounts in paise below). Total = 4305,
  // average = 1435, so nets are -285, -45, +330 (rupees) i.e. -28500, -4500,
  // +33000 paise.
  it("matches the 3-roommate example (1150 / 1390 / 1765 paid over the month)", () => {
    const balances: Balance[] = [
      { userId: "alice", netPaise: -28500 },
      { userId: "bob", netPaise: -4500 },
      { userId: "carol", netPaise: 33000 },
    ];

    const result = simplifyDebts(balances);

    expect(result).toHaveLength(2);
    expect(result).toEqual(
      expect.arrayContaining([
        { fromUserId: "alice", toUserId: "carol", amountPaise: 28500 },
        { fromUserId: "bob", toUserId: "carol", amountPaise: 4500 },
      ])
    );
  });

  it("never produces more than n-1 transactions for n people", () => {
    const balances: Balance[] = [
      { userId: "a", netPaise: 10000 },
      { userId: "b", netPaise: 5000 },
      { userId: "c", netPaise: -7000 },
      { userId: "d", netPaise: -8000 },
    ];
    const result = simplifyDebts(balances);
    expect(result.length).toBeLessThanOrEqual(balances.length - 1);
  });

  it("produces a settlement whose net effect matches the input balances exactly", () => {
    const balances: Balance[] = [
      { userId: "a", netPaise: 12345 },
      { userId: "b", netPaise: -6000 },
      { userId: "c", netPaise: -6345 },
    ];
    const result = simplifyDebts(balances);
    const net = netByUser(result);
    for (const b of balances) {
      expect(net[b.userId] ?? 0).toBe(b.netPaise);
    }
  });

  it("ignores a single person with no counterparty (data bug, not a valid settleable state)", () => {
    const balances: Balance[] = [{ userId: "a", netPaise: 500 }];
    expect(simplifyDebts(balances)).toEqual([]);
  });
});

describe("splitEqually", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(splitEqually(300, ["a", "b", "c"])).toEqual([
      { userId: "a", sharePaise: 100 },
      { userId: "b", sharePaise: 100 },
      { userId: "c", sharePaise: 100 },
    ]);
  });

  it("distributes the remainder paise so the shares sum exactly to the total", () => {
    const result = splitEqually(100, ["a", "b", "c"]);
    const total = result.reduce((sum, s) => sum + s.sharePaise, 0);
    expect(total).toBe(100);
    expect(result).toEqual([
      { userId: "a", sharePaise: 34 },
      { userId: "b", sharePaise: 33 },
      { userId: "c", sharePaise: 33 },
    ]);
  });
});
