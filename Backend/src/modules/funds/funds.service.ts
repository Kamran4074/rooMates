import crypto from "crypto";
import { PoolClient } from "pg";
import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { toPaise } from "../../utils/money";
import { ContributionInput, CreateFundInput, SpendInput } from "./funds.schema";
import { settleFund, summariseFund } from "./funds.summary";
import { getMemberIds } from "../rooms/rooms.repository";

// Room fund ("kitty"): everyone pays a fixed amount to one collector upfront,
// it's spent on shared things, and when it's closed the leftover is settled
// so everyone has paid the same share of what was spent.
//
// Trust model: a payment counts only once both sides agree.
//   member records their own payment        -> collector/admin confirms it
//   collector/admin records a member's one  -> that member approves it (or disputes it)
//   collector/admin records their own one   -> counts at once
// Who recorded, who confirmed and when, and any dispute are all kept on the
// entry - the fund history is the proof.

interface FundRow {
  id: string;
  name: string;
  per_member_paise: string;
  collector_id: string;
  status: "open" | "closed";
  closed_at: string | null;
  created_at: string;
  /** Who's in the fund, in a stable order (it decides who gets leftover paise). */
  participant_ids: string[];
  /** The caller's role in the room - saves a separate membership query. */
  my_role: "admin" | "member" | null;
}

// Every fund read brings its participants and the caller's room role along,
// so one query replaces three. The database is a network hop away and each
// separate query pays that delay again.
const FUND_SELECT = `
  SELECT f.id, f.name, f.per_member_paise, f.collector_id, f.status, f.closed_at, f.created_at,
         ARRAY(SELECT p.user_id FROM fund_participants p WHERE p.fund_id = f.id ORDER BY p.added_at, p.user_id) AS participant_ids,
         (SELECT m.role FROM room_members m WHERE m.room_id = f.room_id AND m.user_id = $1) AS my_role
  FROM room_funds f`;

async function loadFund(client: PoolClient, roomId: string, fundId: string, userId: string, lock = false): Promise<FundRow> {
  const { rows } = await client.query<FundRow>(
    `${FUND_SELECT} WHERE f.id = $2 AND f.room_id = $3 ${lock ? "FOR UPDATE OF f" : ""}`,
    [userId, fundId, roomId]
  );
  if (!rows[0]) throw new AppError("Fund not found", 404);
  return rows[0];
}

// The collector runs the fund; the room admin can always step in.
const canManage = (fund: FundRow, userId: string) => fund.collector_id === userId || fund.my_role === "admin";

function requireManager(fund: FundRow, userId: string) {
  if (!canManage(fund, userId)) {
    throw new AppError("Only the fund's collector or the room admin can do this", 403);
  }
}

function requireOpen(fund: FundRow) {
  if (fund.status !== "open") throw new AppError("This fund is closed", 409);
}

// Confirmed contributions (per member), unconfirmed ones, and spends - for
// every fund in the room in one query. Settlement entries aren't included:
// they're how the leftover is handed out, not part of the running totals.
async function entryTotals(client: PoolClient, roomId: string, fundId?: string) {
  const { rows } = await client.query<{ fund_id: string; kind: string; member_id: string | null; confirmed: boolean; total: string }>(
    `SELECT e.fund_id, e.kind, e.member_id, e.confirmed, SUM(e.amount_paise) AS total
     FROM fund_entries e
     JOIN room_funds f ON f.id = e.fund_id
     WHERE f.room_id = $1 AND ($2::uuid IS NULL OR f.id = $2) AND e.kind IN ('contribution', 'spend')
       AND e.disputed_at IS NULL
     GROUP BY e.fund_id, e.kind, e.member_id, e.confirmed`,
    [roomId, fundId ?? null]
  );

  const paid = new Map<string, Map<string, number>>();
  const awaiting = new Map<string, Map<string, number>>();
  const spent = new Map<string, number>();
  for (const r of rows) {
    const total = Number(r.total);
    if (r.kind === "spend") {
      spent.set(r.fund_id, (spent.get(r.fund_id) ?? 0) + total);
      continue;
    }
    const target = r.confirmed ? paid : awaiting;
    const byMember = target.get(r.fund_id) ?? new Map<string, number>();
    byMember.set(r.member_id!, total);
    target.set(r.fund_id, byMember);
  }
  return { paid, awaiting, spent };
}

type Totals = Awaited<ReturnType<typeof entryTotals>>;

function summarise(fund: FundRow, totals: Totals) {
  const perMemberPaise = Number(fund.per_member_paise);
  return {
    id: fund.id,
    name: fund.name,
    perMemberPaise,
    collectorId: fund.collector_id,
    status: fund.status,
    closedAt: fund.closed_at,
    createdAt: fund.created_at,
    ...summariseFund(
      perMemberPaise,
      fund.participant_ids,
      totals.paid.get(fund.id) ?? new Map(),
      totals.awaiting.get(fund.id) ?? new Map(),
      totals.spent.get(fund.id) ?? 0
    ),
  };
}

// Names for a set of users. LEFT JOIN-style: someone who left the room is no
// longer visible through RLS but stays in the fund's history.
async function namesFor(client: PoolClient, ids: string[]) {
  const { rows } = await client.query<{ id: string; name: string; picture: string | null }>(
    "SELECT id, name, picture FROM users WHERE id = ANY($1::uuid[])",
    [ids]
  );
  const byId = new Map(rows.map((u) => [u.id, u]));
  return (id: string) => ({ name: byId.get(id)?.name ?? "Former member", picture: byId.get(id)?.picture ?? null });
}

export async function listFunds(userId: string, roomId: string) {
  return withUserContext(userId, async (client) => {
    // RLS: a room you're not in has no funds you can see.
    const funds = await client.query<FundRow>(`${FUND_SELECT} WHERE f.room_id = $2 ORDER BY f.created_at DESC`, [
      userId,
      roomId,
    ]);
    const totals = await entryTotals(client, roomId);
    // The list only needs the headline numbers, not every member's row.
    return funds.rows.map((f) => {
      const { members: _members, ...headline } = summarise(f, totals);
      return headline;
    });
  });
}

export async function getFund(userId: string, roomId: string, fundId: string) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId);
    const totals = await entryTotals(client, roomId, fundId);
    const { members, ...summary } = summarise(fund, totals);
    const person = await namesFor(client, [...fund.participant_ids, fund.collector_id]);

    const entries = await client.query(
      `SELECT e.id, e.kind, e.member_id, m.name AS member_name, e.amount_paise::float8 AS amount_paise,
              e.note, e.confirmed, e.created_by, c.name AS created_by_name, e.created_at,
              cb.name AS confirmed_by_name, e.confirmed_at,
              e.disputed_at, db.name AS disputed_by_name, e.dispute_note
       FROM fund_entries e
       LEFT JOIN users m ON m.id = e.member_id
       LEFT JOIN users c ON c.id = e.created_by
       LEFT JOIN users cb ON cb.id = e.confirmed_by
       LEFT JOIN users db ON db.id = e.disputed_by
       WHERE e.fund_id = $1
       ORDER BY e.created_at DESC`,
      [fundId]
    );

    return {
      ...summary,
      collector: { id: fund.collector_id, ...person(fund.collector_id) },
      canManage: canManage(fund, userId),
      members: members.map((m) => ({ ...m, ...person(m.userId) })),
      entries: entries.rows,
    };
  });
}

export async function createFund(userId: string, roomId: string, input: CreateFundInput) {
  return withUserContext(userId, async (client) => {
    const roomMembers = await getMemberIds(client, roomId);
    const participantIds = [...new Set(input.participantIds ?? roomMembers)];
    if (participantIds.some((id) => !roomMembers.includes(id))) {
      throw new AppError("Everyone in the fund must be a member of this room", 400);
    }

    const { rows } = await client.query<{ user_id: string }>(
      "SELECT user_id FROM room_members WHERE room_id = $1 AND role = 'admin' LIMIT 1",
      [roomId]
    );
    const collectorId = input.collectorId ?? rows[0]?.user_id ?? userId;
    if (!participantIds.includes(collectorId)) {
      throw new AppError("The collector must be one of the people in the fund", 400);
    }

    const id = crypto.randomUUID();
    await client.query(
      "INSERT INTO room_funds (id, room_id, name, per_member_paise, collector_id, created_by) VALUES ($1, $2, $3, $4, $5, $6)",
      [id, roomId, input.name, toPaise(input.amountPerMember), collectorId, userId]
    );
    await client.query(
      "INSERT INTO fund_participants (fund_id, user_id) SELECT $1, unnest($2::uuid[])",
      [id, participantIds]
    );
    return { id, name: input.name };
  });
}

// Locks the fund row for the rest of the transaction, so two people spending
// at the same moment can't both pass the balance check and overdraw it.
// Only confirmed money is in the pot.
async function lockedBalance(client: PoolClient, fundId: string): Promise<number> {
  const { rows } = await client.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN kind = 'contribution' AND confirmed THEN amount_paise
                              WHEN kind = 'spend' THEN -amount_paise ELSE 0 END), 0) AS balance
     FROM fund_entries WHERE fund_id = $1`,
    [fundId]
  );
  return Number(rows[0].balance);
}

export async function addContribution(userId: string, roomId: string, fundId: string, input: ContributionInput) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId);
    requireOpen(fund);
    if (!fund.participant_ids.includes(input.memberId)) throw new AppError("That person isn't part of this fund", 400);

    // Members record only their own payments; the collector/admin can record anyone's.
    const manager = canManage(fund, userId);
    if (input.memberId !== userId && !manager) {
      throw new AppError("You can only record your own payments", 403);
    }

    // Both sides agree at once only when the collector/admin records their own
    // payment. Otherwise it waits for the other side: the member for a record
    // made about them, the collector for a member's own record.
    const confirmed = manager && input.memberId === userId;
    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO fund_entries (id, fund_id, kind, member_id, amount_paise, note, confirmed, created_by, confirmed_by, confirmed_at)
       VALUES ($1, $2, 'contribution', $3, $4, $5, $6, $7,
               CASE WHEN $6 THEN $7::uuid END, CASE WHEN $6 THEN now() END)`,
      [id, fundId, input.memberId, toPaise(input.amount), input.note || null, confirmed, userId]
    );
    const waitingFor = confirmed ? null : input.memberId === userId ? ("collector" as const) : ("member" as const);
    return { id, confirmed, waitingFor };
  });
}

interface EntryRow {
  kind: "contribution" | "spend" | "refund" | "collection";
  member_id: string | null;
  created_by: string;
  confirmed: boolean;
  disputed_at: Date | null;
  amount_paise: string;
}

async function loadEntry(client: PoolClient, fundId: string, entryId: string): Promise<EntryRow> {
  const { rows } = await client.query<EntryRow>(
    "SELECT kind, member_id, created_by, confirmed, disputed_at, amount_paise FROM fund_entries WHERE id = $1 AND fund_id = $2 FOR UPDATE",
    [entryId, fundId]
  );
  if (!rows[0]) throw new AppError("Entry not found", 404);
  return rows[0];
}

// A payment recorded by the collector/admin about someone else: that person
// is the one who approves or disputes it.
const recordedAboutMember = (e: EntryRow) => e.kind === "contribution" && e.created_by !== e.member_id;

// "Yes, that's right": the other side of a payment agrees.
//   - a member's own record           -> the collector/admin confirms ("I got it")
//   - the collector's record about you -> you approve it ("yes, I paid that")
//   - after closing, a refund/collection -> the collector/admin marks it done
export async function confirmEntry(userId: string, roomId: string, fundId: string, entryId: string) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId);
    const entry = await loadEntry(client, fundId, entryId);
    if (entry.kind === "spend") throw new AppError("Spends don't need confirming", 400);
    if (entry.confirmed) throw new AppError("Nothing to confirm - it's already confirmed", 409);
    if (entry.disputed_at) throw new AppError("This payment was disputed. Record a corrected one instead.", 409);

    if (recordedAboutMember(entry)) {
      if (entry.member_id !== userId) {
        throw new AppError("Only the person this payment is for can approve it", 403);
      }
    } else {
      requireManager(fund, userId);
    }
    if (entry.kind === "contribution") requireOpen(fund);

    await client.query("UPDATE fund_entries SET confirmed = true, confirmed_by = $2, confirmed_at = now() WHERE id = $1", [
      entryId,
      userId,
    ]);
    return { id: entryId, confirmed: true };
  });
}

// "That's not right": the member says the collector's record about them is
// wrong (wrong amount, never paid). It stops counting but is kept - with who
// disputed it, when and why - and can't be deleted.
export async function disputeEntry(userId: string, roomId: string, fundId: string, entryId: string, note: string) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId);
    requireOpen(fund);
    const entry = await loadEntry(client, fundId, entryId);
    if (!recordedAboutMember(entry) || entry.member_id !== userId) {
      throw new AppError("You can only dispute a payment someone else recorded for you", 403);
    }
    if (entry.confirmed) throw new AppError("You already approved this payment", 409);
    if (entry.disputed_at) throw new AppError("You already disputed this payment", 409);

    await client.query(
      "UPDATE fund_entries SET disputed_at = now(), disputed_by = $2, dispute_note = $3 WHERE id = $1",
      [entryId, userId, note]
    );
    return { id: entryId, disputed: true };
  });
}

// Payments the collector/admin recorded for me that I haven't approved yet,
// across every room I'm in (RLS keeps it to my rooms). Shown on Expenses.
export async function listMyPendingApprovals(userId: string) {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query(
      `SELECT e.id, e.fund_id, f.name AS fund_name, f.room_id, r.name AS room_name, r.type AS room_type,
              e.amount_paise::float8 AS amount_paise, e.note, e.created_at,
              e.created_by, COALESCE(c.name, 'Former member') AS recorded_by_name
       FROM fund_entries e
       JOIN room_funds f ON f.id = e.fund_id
       JOIN rooms r ON r.id = f.room_id
       LEFT JOIN users c ON c.id = e.created_by
       WHERE e.member_id = $1 AND e.kind = 'contribution' AND NOT e.confirmed AND e.disputed_at IS NULL
         AND e.created_by <> $1 AND f.status = 'open'
       ORDER BY e.created_at`,
      [userId]
    );
    return rows;
  });
}

export async function addSpend(userId: string, roomId: string, fundId: string, input: SpendInput) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId, true);
    requireOpen(fund);
    const balance = await lockedBalance(client, fundId);
    const amountPaise = toPaise(input.amount);
    if (amountPaise > balance) {
      throw new AppError(`The fund only has ₹${(balance / 100).toFixed(2)} left`, 400);
    }

    const id = crypto.randomUUID();
    await client.query(
      `INSERT INTO fund_entries (id, fund_id, kind, amount_paise, note, confirmed, created_by, confirmed_by, confirmed_at)
       VALUES ($1, $2, 'spend', $3, $4, true, $5, $5, now())`,
      [id, fundId, amountPaise, input.description, userId]
    );
    return { id };
  });
}

// Deleting: your own entries, or (collector/admin) rejecting a payment
// someone else recorded that never arrived.
export async function deleteEntry(userId: string, roomId: string, fundId: string, entryId: string) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId, true);
    requireOpen(fund);
    const entry = await loadEntry(client, fundId, entryId);
    if (entry.disputed_at) {
      throw new AppError("A disputed payment stays in the history as a record. Record a corrected payment instead.", 409);
    }
    const rejectingPending = entry.kind === "contribution" && !entry.confirmed && canManage(fund, userId);
    if (entry.created_by !== userId && !rejectingPending) {
      throw new AppError("Only the person who recorded this can delete it", 403);
    }

    // Removing a confirmed payment whose money has already been spent would
    // leave the fund negative - the spend should be removed first.
    const balance = await lockedBalance(client, fundId);
    if (entry.kind === "contribution" && entry.confirmed && balance - Number(entry.amount_paise) < 0) {
      throw new AppError("This money has already been spent from the fund. Delete those spends first.", 409);
    }

    await client.query("DELETE FROM fund_entries WHERE id = $1", [entryId]);
  });
}

// ---------------- Closing ----------------

async function computeSettlement(client: PoolClient, roomId: string, fund: FundRow) {
  const participantIds = fund.participant_ids;
  const totals = await entryTotals(client, roomId, fund.id);
  const paid = totals.paid.get(fund.id) ?? new Map<string, number>();
  const spentPaise = totals.spent.get(fund.id) ?? 0;
  const awaitingCount = [...(totals.awaiting.get(fund.id)?.values() ?? [])].length;
  const { lines, transfers } = settleFund(participantIds, fund.collector_id, paid, spentPaise);
  return { participantIds, spentPaise, awaitingCount, lines, transfers };
}

// What closing would do, without doing it - shown before the collector confirms.
export async function previewClose(userId: string, roomId: string, fundId: string) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId);
    requireManager(fund, userId);
    requireOpen(fund);
    const s = await computeSettlement(client, roomId, fund);
    const person = await namesFor(client, s.participantIds);
    return {
      spentPaise: s.spentPaise,
      sharePerPersonPaise: s.participantIds.length ? Math.floor(s.spentPaise / s.participantIds.length) : 0,
      unconfirmedPayments: s.awaitingCount,
      lines: s.lines.map((l) => ({ ...l, name: person(l.userId).name, isCollector: l.userId === fund.collector_id })),
      transfers: s.transfers.map((t) => ({ ...t, name: person(t.userId).name })),
    };
  });
}

// Closes the fund and records who gets money back / who still owes. The lock
// stops a payment or spend slipping in between the calculation and the close.
export async function closeFund(userId: string, roomId: string, fundId: string) {
  return withUserContext(userId, async (client) => {
    const fund = await loadFund(client, roomId, fundId, userId, true);
    requireManager(fund, userId);
    requireOpen(fund);
    const s = await computeSettlement(client, roomId, fund);
    if (s.awaitingCount > 0) {
      throw new AppError("Confirm or reject the payments still waiting for confirmation first", 409);
    }

    if (s.transfers.length) {
      await client.query(
        `INSERT INTO fund_entries (fund_id, kind, member_id, amount_paise, confirmed, created_by)
         SELECT $1, t.kind, t.member_id, t.amount, false, $2
         FROM unnest($3::text[], $4::uuid[], $5::bigint[]) AS t(kind, member_id, amount)`,
        [fundId, userId, s.transfers.map((t) => t.kind), s.transfers.map((t) => t.userId), s.transfers.map((t) => t.amountPaise)]
      );
    }
    await client.query("UPDATE room_funds SET status = 'closed', closed_at = now() WHERE id = $1", [fundId]);
    return { id: fundId, status: "closed" as const, transfers: s.transfers.length };
  });
}
