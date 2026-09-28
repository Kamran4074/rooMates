export interface Balance {
  userId: string;
  netPaise: number; // positive = is owed money, negative = owes money
}

export interface SettlementTransaction {
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
}

// Greedy debt simplification: repeatedly match the largest creditor with the
// largest debtor. This always produces a valid settlement in at most n-1
// transactions for n people with a nonzero balance, and matches the optimal
// answer in the common case. Finding the PROVABLY minimum number of
// transactions for an arbitrary set of balances is NP-hard (it reduces to a
// subset-sum/partition problem - you'd need to find zero-sum subgroups that
// can settle internally), so this is a deliberate, documented trade-off
// rather than an oversight.
export function simplifyDebts(balances: Balance[]): SettlementTransaction[] {
  const creditors = balances
    .filter((b) => b.netPaise > 0)
    .map((b) => ({ userId: b.userId, amount: b.netPaise }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter((b) => b.netPaise < 0)
    .map((b) => ({ userId: b.userId, amount: -b.netPaise }))
    .sort((a, b) => b.amount - a.amount);

  const transactions: SettlementTransaction[] = [];
  let i = 0;
  let j = 0;

  while (i < creditors.length && j < debtors.length) {
    const settled = Math.min(creditors[i].amount, debtors[j].amount);
    if (settled > 0) {
      transactions.push({
        fromUserId: debtors[j].userId,
        toUserId: creditors[i].userId,
        amountPaise: settled,
      });
    }

    creditors[i].amount -= settled;
    debtors[j].amount -= settled;

    if (creditors[i].amount === 0) i++;
    if (debtors[j].amount === 0) j++;
  }

  return transactions;
}

// Splits totalPaise as evenly as possible across userIds, distributing the
// leftover paise (from integer division) one at a time to the first N users
// so the shares always sum EXACTLY to totalPaise. Without this, splitting
// e.g. 100 paise three ways as floor(100/3)=33 each would silently lose 1
// paise - fine once, but it compounds across thousands of expenses.
export function splitEqually(totalPaise: number, userIds: string[]): { userId: string; sharePaise: number }[] {
  const base = Math.floor(totalPaise / userIds.length);
  const remainder = totalPaise - base * userIds.length;

  return userIds.map((userId, index) => ({
    userId,
    sharePaise: base + (index < remainder ? 1 : 0),
  }));
}
