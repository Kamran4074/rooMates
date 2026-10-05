import { settleFund, summariseFund } from "./funds.summary";

const members = ["aman", "bhavya", "chirag"];
const none = new Map<string, number>();

describe("summariseFund", () => {
  it("tracks partial payments: ₹1000 now, ₹500 still pending", () => {
    const paid = new Map([
      ["aman", 150000],
      ["bhavya", 100000],
    ]);
    const s = summariseFund(150000, members, paid, none, 0);

    expect(s.expectedPaise).toBe(450000);
    expect(s.collectedPaise).toBe(250000);
    expect(s.members.find((m) => m.userId === "bhavya")?.pendingPaise).toBe(50000);
    expect(s.members.find((m) => m.userId === "chirag")?.pendingPaise).toBe(150000);
    expect(s.pendingPaise).toBe(200000);
  });

  it("doesn't let one member's overpayment hide another member's dues", () => {
    const s = summariseFund(150000, members, new Map([["aman", 300000]]), none, 0);
    expect(s.collectedPaise).toBe(300000);
    // expected - collected would say only ₹1500 is pending; it's ₹3000.
    expect(s.pendingPaise).toBe(300000);
  });

  it("unconfirmed payments are shown but don't count as collected", () => {
    const s = summariseFund(150000, members, none, new Map([["chirag", 150000]]), 0);
    expect(s.collectedPaise).toBe(0);
    expect(s.awaitingConfirmationPaise).toBe(150000);
    expect(s.members.find((m) => m.userId === "chirag")).toEqual(
      expect.objectContaining({ paidPaise: 0, awaitingPaise: 150000, pendingPaise: 150000 })
    );
  });

  it("balance is what was collected minus what was spent", () => {
    const paid = new Map(members.map((m) => [m, 150000]));
    expect(summariseFund(150000, members, paid, none, 120000).balancePaise).toBe(330000);
  });
});

describe("settleFund", () => {
  it("refunds overpayers and collects from underpayers (equal-cost model)", () => {
    // Aman (collector) and Bhavya paid ₹1500, Chirag only ₹1000; ₹3000 spent.
    const paid = new Map([
      ["aman", 150000],
      ["bhavya", 150000],
      ["chirag", 100000],
    ]);
    const { lines, transfers } = settleFund(members, "aman", paid, 300000);

    expect(lines.map((l) => l.netPaise)).toEqual([50000, 50000, 0]);
    // Aman holds the cash, so only Bhavya needs a transfer.
    expect(transfers).toEqual([{ userId: "bhavya", kind: "refund", amountPaise: 50000 }]);
  });

  it("someone who paid nothing pays their share of what was spent", () => {
    const paid = new Map([
      ["aman", 150000],
      ["bhavya", 150000],
    ]);
    const { transfers } = settleFund(members, "aman", paid, 240000); // ₹800 each
    expect(transfers).toEqual([
      { userId: "bhavya", kind: "refund", amountPaise: 70000 },
      { userId: "chirag", kind: "collection", amountPaise: 80000 },
    ]);
  });

  it("the money always adds up: refunds - collections = cash left with the collector minus the collector's own net", () => {
    const paid = new Map([
      ["aman", 123456],
      ["bhavya", 99999],
      ["chirag", 150001],
    ]);
    const spent = 210001; // doesn't divide evenly by 3
    const { lines, transfers } = settleFund(members, "bhavya", paid, spent);

    expect(lines.reduce((s, l) => s + l.sharePaise, 0)).toBe(spent); // shares sum exactly
    const cashLeft = 123456 + 99999 + 150001 - spent;
    const collectorNet = lines.find((l) => l.userId === "bhavya")!.netPaise;
    const out = transfers.reduce((s, t) => s + (t.kind === "refund" ? t.amountPaise : -t.amountPaise), 0);
    expect(out).toBe(cashLeft - collectorNet);
  });

  it("nothing spent: everyone gets back exactly what they paid", () => {
    const paid = new Map([
      ["aman", 150000],
      ["bhavya", 150000],
    ]);
    const { transfers } = settleFund(members, "aman", paid, 0);
    expect(transfers).toEqual([{ userId: "bhavya", kind: "refund", amountPaise: 150000 }]);
  });
});
