import { splitEqually } from "../settlement/settlement.algorithm";

// Pure money maths for a room fund - no database, so it's unit-tested directly.

export interface MemberProgress {
  userId: string;
  /** Confirmed money this member has paid in. */
  paidPaise: number;
  /** Recorded by the member, not yet confirmed by the collector. */
  awaitingPaise: number;
  /** Still owed towards their share; 0 once paid in full. */
  pendingPaise: number;
}

export interface FundSummary {
  /** per-member amount x participants */
  expectedPaise: number;
  /** Confirmed contributions only - money the collector actually has. */
  collectedPaise: number;
  awaitingConfirmationPaise: number;
  spentPaise: number;
  /** Cash the collector should be holding right now. */
  balancePaise: number;
  pendingPaise: number;
  members: MemberProgress[];
}

// Pending is summed per member, not as (expected - collected): if one person
// pays ₹2000 against a ₹1500 share, their extra ₹500 doesn't cancel out a
// roommate who hasn't paid at all - that roommate still owes their ₹1500.
// Only confirmed money counts: "I paid" isn't paid until the collector says so.
export function summariseFund(
  perMemberPaise: number,
  participantIds: string[],
  paidByMember: Map<string, number>,
  awaitingByMember: Map<string, number>,
  spentPaise: number
): FundSummary {
  const members = participantIds.map((userId) => {
    const paidPaise = paidByMember.get(userId) ?? 0;
    return {
      userId,
      paidPaise,
      awaitingPaise: awaitingByMember.get(userId) ?? 0,
      pendingPaise: Math.max(perMemberPaise - paidPaise, 0),
    };
  });

  const collectedPaise = [...paidByMember.values()].reduce((sum, p) => sum + p, 0);

  return {
    expectedPaise: perMemberPaise * participantIds.length,
    collectedPaise,
    awaitingConfirmationPaise: [...awaitingByMember.values()].reduce((sum, p) => sum + p, 0),
    spentPaise,
    balancePaise: collectedPaise - spentPaise,
    pendingPaise: members.reduce((sum, m) => sum + m.pendingPaise, 0),
    members,
  };
}

export interface SettlementLine {
  userId: string;
  paidPaise: number;
  /** This member's equal part of everything spent. */
  sharePaise: number;
  /** paid - share: positive = gets money back, negative = owes the collector. */
  netPaise: number;
}

export interface SettlementTransfer {
  userId: string;
  /** refund: collector -> member. collection: member -> collector. */
  kind: "refund" | "collection";
  amountPaise: number;
}

// Closing a fund. Everyone used the pool equally, so each participant's fair
// cost is total spent / participants (split to the paisa, with the leftover
// paise spread so shares add up exactly). Then:
//   net = what they paid - their share
// A positive net is refunded by the collector, a negative one is paid to the
// collector. The collector's own net needs no transfer - they're holding the
// cash. Total refunds - total collections always equals the cash left over.
//
// Why not refund in proportion to what people paid? Then someone who paid
// less than their share would never cover their part of the spending.
export function settleFund(
  participantIds: string[],
  collectorId: string,
  paidByMember: Map<string, number>,
  spentPaise: number
): { lines: SettlementLine[]; transfers: SettlementTransfer[] } {
  const shares = new Map(splitEqually(spentPaise, participantIds).map((s) => [s.userId, s.sharePaise]));

  const lines = participantIds.map((userId) => {
    const paidPaise = paidByMember.get(userId) ?? 0;
    const sharePaise = shares.get(userId) ?? 0;
    return { userId, paidPaise, sharePaise, netPaise: paidPaise - sharePaise };
  });

  const transfers: SettlementTransfer[] = lines
    .filter((l) => l.userId !== collectorId && l.netPaise !== 0)
    .map((l) => ({
      userId: l.userId,
      kind: l.netPaise > 0 ? "refund" : "collection",
      amountPaise: Math.abs(l.netPaise),
    }));

  return { lines, transfers };
}
