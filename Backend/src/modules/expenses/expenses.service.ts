import { PoolClient } from "pg";
import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { CreateExpenseInput, MonthExpensesQuery, todayInIndia } from "./expenses.schema";
import { splitEqually, simplifyDebts, Balance } from "../settlement/settlement.algorithm";
import { toPaise } from "../../utils/money";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";
import { getMemberIds, requireMember } from "../rooms/rooms.repository";
import { getCategory } from "../categories/categories.service";

type Split = { userId: string; sharePaise: number };

// Payer, date, section and shares for an expense, checked against the room's
// current members. Adding and editing go through this, so both follow the
// same rules.
async function resolveExpense(client: PoolClient, roomId: string, userId: string, input: CreateExpenseInput) {
  const amountPaise = toPaise(input.amount);
  // RLS hides rooms the caller isn't in, so this 404s for someone else's room.
  const memberIds = new Set(await getMemberIds(client, roomId));

  // Anyone in the room can record that someone else paid ("Bhavya bought the
  // milk"), like in Splitwise; the payer just has to be in the room.
  const paidBy = input.paidBy ?? userId;
  if (!memberIds.has(paidBy)) throw new AppError("Whoever paid must be a member of this room", 400);
  const expenseDate = input.expenseDate ?? todayInIndia();

  // A section (Rent, Groceries...) decides who shares the bill by default.
  const category = input.categoryId ? await getCategory(client, roomId, input.categoryId) : null;

  let splits: Split[];
  if (input.splitType === "equal") {
    // Equal split between the people sharing it: chosen for this expense,
    // else the section's people, else everyone in the room.
    const sharing = [...new Set(input.participantIds ?? category?.member_ids ?? [...memberIds])];
    if (sharing.length === 0) throw new AppError("Nobody is in this section yet. Pick who shares this expense.", 400);
    if (sharing.some((id) => !memberIds.has(id))) throw new AppError("Everyone sharing it must be a member of this room", 400);
    splits = splitEqually(amountPaise, sharing);
  } else {
    splits = input.splits!.map((s) => ({ userId: s.userId, sharePaise: toPaise(s.amount) }));

    // Shares must belong to room members, once each. A share assigned to an
    // outsider would make the room's balances stop summing to zero, which
    // breaks the settle-up plan for everyone in the room.
    const seen = new Set<string>();
    for (const s of splits) {
      if (!memberIds.has(s.userId)) throw new AppError("Every split must be for a member of this room", 400);
      if (seen.has(s.userId)) throw new AppError("Each member can appear only once in the splits", 400);
      seen.add(s.userId);
    }

    const splitTotal = splits.reduce((sum, s) => sum + s.sharePaise, 0);
    if (splitTotal !== amountPaise) {
      throw new AppError(
        `Split amounts (${splitTotal / 100}) must add up to the total expense amount (${amountPaise / 100})`,
        400
      );
    }
  }

  return { amountPaise, paidBy, expenseDate, categoryId: category?.id ?? null, splits, memberIds };
}

async function insertSplits(client: PoolClient, expenseId: string, roomId: string, splits: Split[]) {
  // One round trip for all shares instead of one INSERT per member.
  await client.query(
    // room_id must match the expense's room - a composite foreign key checks it.
    `INSERT INTO expense_splits (expense_id, room_id, user_id, share_paise)
     SELECT $1, $2, s.user_id, s.share_paise FROM unnest($3::uuid[], $4::bigint[]) AS s(user_id, share_paise)`,
    [expenseId, roomId, splits.map((s) => s.userId), splits.map((s) => s.sharePaise)]
  );
}

export async function createExpense(userId: string, roomId: string, input: CreateExpenseInput) {
  return withUserContext(userId, async (client) => {
    const { amountPaise, paidBy, expenseDate, categoryId, splits } = await resolveExpense(client, roomId, userId, input);

    // The id comes from the database (uuidv7: time-ordered, index-friendly).
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO expenses (room_id, paid_by, description, amount_paise, expense_date, created_by, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [roomId, paidBy, input.description, amountPaise, expenseDate, userId, categoryId]
    );
    const expenseId = inserted.rows[0].id;
    await insertSplits(client, expenseId, roomId, splits);

    return { id: expenseId, description: input.description, amountPaise, paidBy, expenseDate, categoryId, splits };
  });
}

interface ExpenseRow {
  id: string;
  description: string;
  amount_paise: string;
  paid_by: string;
  expense_date: string;
  category_id: string | null;
  created_by: string;
  edited_at: string | null;
}

async function loadExpense(client: PoolClient, roomId: string, expenseId: string) {
  const { rows } = await client.query<ExpenseRow>(
    `SELECT id, description, amount_paise, paid_by, expense_date::text AS expense_date, category_id, created_by, edited_at
     FROM expenses WHERE id = $1 AND room_id = $2 AND deleted_at IS NULL`,
    [expenseId, roomId]
  );
  if (!rows[0]) throw new AppError("Expense not found", 404);
  const splits = await client.query<{ user_id: string; share_paise: string }>(
    "SELECT user_id, share_paise FROM expense_splits WHERE expense_id = $1 ORDER BY user_id",
    [expenseId]
  );
  return {
    expense: rows[0],
    splits: splits.rows.map((s) => ({ userId: s.user_id, sharePaise: Number(s.share_paise) })),
  };
}

// The split type isn't stored. Equal splits differ by at most one paisa
// (the remainder of dividing), so anything else was typed in as custom.
// Only used to pre-fill the edit form.
function looksEqual(splits: Split[]) {
  const shares = splits.map((s) => s.sharePaise);
  return shares.length > 0 && Math.max(...shares) - Math.min(...shares) <= 1;
}

// One expense with its shares - what the edit form starts from.
export async function getExpense(userId: string, roomId: string, expenseId: string) {
  return withUserContext(userId, async (client) => {
    const role = await requireMember(client, roomId, userId);
    const { expense, splits } = await loadExpense(client, roomId, expenseId);
    const equal = looksEqual(splits);
    return {
      id: expense.id,
      description: expense.description,
      amountPaise: Number(expense.amount_paise),
      paidBy: expense.paid_by,
      expenseDate: expense.expense_date,
      categoryId: expense.category_id,
      createdBy: expense.created_by,
      editedAt: expense.edited_at,
      splitType: equal ? ("equal" as const) : ("custom" as const),
      participantIds: equal ? splits.map((s) => s.userId) : splits.filter((s) => s.sharePaise > 0).map((s) => s.userId),
      splits,
      canEdit: expense.created_by === userId || role === "admin",
    };
  });
}

const sameSplits = (a: Split[], b: Split[]) => {
  const key = (list: Split[]) =>
    list
      .filter((s) => s.sharePaise > 0)
      .map((s) => `${s.userId}:${s.sharePaise}`)
      .sort()
      .join(",");
  return key(a) === key(b);
};

// Edit = replace the expense's details and shares, keeping its id. Same
// people as delete (whoever added it or the room admin), same checks as
// adding. The activity trigger records what changed, old and new.
export async function updateExpense(userId: string, roomId: string, expenseId: string, input: CreateExpenseInput) {
  return withUserContext(userId, async (client) => {
    const role = await requireMember(client, roomId, userId);
    // Lock first, read second: of two edits at once, the second waits here and
    // then reads what the first saved. (For someone who may not edit, RLS
    // makes this lock nothing; the check below turns that into a 403.)
    await client.query("SELECT 1 FROM expenses WHERE id = $1 FOR UPDATE", [expenseId]);
    const { expense, splits: oldSplits } = await loadExpense(client, roomId, expenseId);
    if (expense.created_by !== userId && role !== "admin") {
      throw new AppError("Only whoever added this expense or the room admin can edit it", 403);
    }

    const next = await resolveExpense(client, roomId, userId, input);

    // Someone who left had to settle to zero first. Changing what they paid
    // or owe now would give them a balance they can no longer settle.
    const involved = [expense.paid_by, ...oldSplits.filter((s) => s.sharePaise > 0).map((s) => s.userId)];
    if (involved.some((id) => !next.memberIds.has(id))) {
      throw new AppError(
        "Someone on this expense has left the room, so it can't be changed - their balance was already settled.",
        409
      );
    }

    const splitsChanged = !sameSplits(oldSplits, next.splits);
    const unchanged =
      !splitsChanged &&
      expense.description === input.description &&
      Number(expense.amount_paise) === next.amountPaise &&
      expense.paid_by === next.paidBy &&
      expense.expense_date === next.expenseDate &&
      expense.category_id === next.categoryId;
    // Nothing to save: no write, no "edited" entry in the feed.
    if (unchanged) return { id: expenseId, changed: false };

    if (splitsChanged) {
      await client.query("DELETE FROM expense_splits WHERE expense_id = $1", [expenseId]);
      await insertSplits(client, expenseId, roomId, next.splits);
    }
    await client.query(
      `UPDATE expenses
       SET description = $2, amount_paise = $3, paid_by = $4, expense_date = $5, category_id = $6,
           edited_at = now(), edited_by = $7
       WHERE id = $1`,
      [expenseId, input.description, next.amountPaise, next.paidBy, next.expenseDate, next.categoryId, userId]
    );
    return { id: expenseId, changed: true };
  });
}

// Soft delete: the row stays (who deleted it and when), but it drops out of
// every list and balance. Whoever added it or the room admin may do this; the
// RLS update policy enforces the same rule.
export async function deleteExpense(userId: string, roomId: string, expenseId: string) {
  return withUserContext(userId, async (client) => {
    const role = await requireMember(client, roomId, userId);
    const { rows } = await client.query<{ created_by: string }>(
      "SELECT created_by FROM expenses WHERE id = $1 AND room_id = $2 AND deleted_at IS NULL",
      [expenseId, roomId]
    );
    if (!rows[0]) throw new AppError("Expense not found", 404);
    if (rows[0].created_by !== userId && role !== "admin") {
      throw new AppError("Only whoever added this expense or the room admin can delete it", 403);
    }
    await client.query("UPDATE expenses SET deleted_at = now(), deleted_by = $2 WHERE id = $1", [expenseId, userId]);
  });
}

export async function listExpenses(userId: string, roomId: string, params: PageParams) {
  return withUserContext(userId, async (client) => {
    await requireMember(client, roomId, userId);
    const { limit, offset } = toLimitOffset(params);
    const result = await client.query(
      // LEFT JOIN: once someone leaves the room, RLS hides their user row, but
      // the expenses they paid for are still part of the room's history.
      `SELECT e.id, e.description, e.amount_paise, e.paid_by, e.expense_date::text AS expense_date, e.created_at,
              e.created_by, e.edited_at, COALESCE(u.name, 'Former member') AS paid_by_name,
              c.name AS category_name,
              (SELECT COUNT(*)::int FROM expense_splits es WHERE es.expense_id = e.id AND es.share_paise > 0) AS shared_by,
              COUNT(*) OVER() AS total_count
       FROM expenses e
       LEFT JOIN users u ON u.id = e.paid_by
       LEFT JOIN expense_categories c ON c.id = e.category_id
       WHERE e.room_id = $1 AND e.deleted_at IS NULL
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $2 OFFSET $3`,
      [roomId, limit, offset]
    );
    return paginate(result.rows, params);
  });
}

export async function getRoomBalances(userId: string, roomId: string) {
  return withUserContext(userId, (client) => computeRoomBalances(client, roomId));
}

// Takes a client so it runs under whoever's context the caller set up: a
// member's (RLS-scoped) in getRoomBalances, the super admin's in the admin module.
export async function computeRoomBalances(client: PoolClient, roomId: string) {
  // One query: each member's name and net balance from room_ledger (what they
  // paid - their shares + payments they made - payments they received; deleted
  // expenses and payments excluded). Every balance in the app reads that view.
  const members = await client.query<{ user_id: string; name: string; net: string }>(
    `SELECT rm.user_id, u.name, COALESCE(l.net, 0) AS net
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     LEFT JOIN (
       SELECT user_id, SUM(amount_paise) AS net FROM room_ledger WHERE room_id = $1 GROUP BY user_id
     ) l ON l.user_id = rm.user_id
     WHERE rm.room_id = $1`,
    [roomId]
  );

  const balances: (Balance & { name: string })[] = members.rows.map((m) => ({
    userId: m.user_id,
    name: m.name,
    netPaise: Number(m.net),
  }));

  const nameByUserId = new Map(members.rows.map((m) => [m.user_id, m.name]));
  const settlements = simplifyDebts(balances).map((t) => ({
    ...t,
    fromName: nameByUserId.get(t.fromUserId),
    toName: nameByUserId.get(t.toUserId),
  }));

  return { balances, settlements };
}

// Months come from expense_date: the calendar day (in India) the money was
// spent, chosen by whoever added it. No time-zone maths needed at query time.

// Every expense in every room the caller belongs to, for one month. There's
// no "rooms I'm in" filter here on purpose: RLS already hides other rooms.
export async function listMyExpenses(userId: string, { month, roomId }: MonthExpensesQuery) {
  return withUserContext(userId, async (client) => {
    const result = await client.query<{
      id: string;
      description: string;
      amount_paise: string;
      my_share_paise: string;
      expense_date: string;
      created_at: string;
      paid_by: string;
      paid_by_name: string;
      room_id: string;
      room_name: string;
      room_type: string;
    }>(
      `SELECT e.id, e.description, e.amount_paise, e.expense_date::text AS expense_date, e.created_at, e.paid_by,
              COALESCE(u.name, 'Former member') AS paid_by_name,
              r.id AS room_id, r.name AS room_name, r.type AS room_type,
              COALESCE(es.share_paise, 0) AS my_share_paise, c.name AS category_name
       FROM expenses e
       JOIN rooms r ON r.id = e.room_id
       LEFT JOIN expense_categories c ON c.id = e.category_id
       LEFT JOIN users u ON u.id = e.paid_by
       LEFT JOIN expense_splits es ON es.expense_id = e.id AND es.user_id = $1
       WHERE e.deleted_at IS NULL
         AND e.expense_date >= $2::date
         AND e.expense_date <  ($2::date + interval '1 month')
         AND ($3::uuid IS NULL OR e.room_id = $3)
       ORDER BY e.expense_date DESC, e.created_at DESC`,
      [userId, `${month}-01`, roomId ?? null]
    );
    return result.rows.map((r) => ({
      ...r,
      amount_paise: Number(r.amount_paise),
      my_share_paise: Number(r.my_share_paise),
    }));
  });
}

// One row per month: what the group spent, what the caller paid, and the
// caller's share. net = paid - share (positive = others owe you for that month).
export async function getMonthlySummary(userId: string, roomId?: string) {
  return withUserContext(userId, async (client) => {
    const result = await client.query<{
      month: string;
      expense_count: string;
      total_paise: string;
      i_paid_paise: string;
      my_share_paise: string;
    }>(
      `SELECT to_char(e.expense_date, 'YYYY-MM') AS month,
              COUNT(*) AS expense_count,
              SUM(e.amount_paise) AS total_paise,
              SUM(CASE WHEN e.paid_by = $1 THEN e.amount_paise ELSE 0 END) AS i_paid_paise,
              SUM(COALESCE(es.share_paise, 0)) AS my_share_paise
       FROM expenses e
       LEFT JOIN expense_splits es ON es.expense_id = e.id AND es.user_id = $1
       WHERE e.deleted_at IS NULL AND ($2::uuid IS NULL OR e.room_id = $2)
       GROUP BY 1
       ORDER BY 1 DESC`,
      [userId, roomId ?? null]
    );
    return result.rows.map((r) => {
      const iPaid = Number(r.i_paid_paise);
      const myShare = Number(r.my_share_paise);
      return {
        month: r.month,
        expenseCount: Number(r.expense_count),
        totalPaise: Number(r.total_paise),
        iPaidPaise: iPaid,
        mySharePaise: myShare,
        netPaise: iPaid - myShare,
      };
    });
  });
}

// One month, split by bill section - for the dashboard's breakdown chart.
// Expenses without a section come back with category null ("Other").
export async function getCategoryBreakdown(userId: string, { month, roomId }: MonthExpensesQuery) {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query<{ category: string | null; total_paise: string; my_share_paise: string; expense_count: number }>(
      `SELECT c.name AS category,
              SUM(e.amount_paise) AS total_paise,
              SUM(COALESCE(es.share_paise, 0)) AS my_share_paise,
              COUNT(*)::int AS expense_count
       FROM expenses e
       LEFT JOIN expense_categories c ON c.id = e.category_id
       LEFT JOIN expense_splits es ON es.expense_id = e.id AND es.user_id = $1
       WHERE e.deleted_at IS NULL
         AND e.expense_date >= $2::date
         AND e.expense_date <  ($2::date + interval '1 month')
         AND ($3::uuid IS NULL OR e.room_id = $3)
       GROUP BY c.name
       ORDER BY SUM(e.amount_paise) DESC`,
      [userId, `${month}-01`, roomId ?? null]
    );
    return rows.map((r) => ({
      category: r.category,
      totalPaise: Number(r.total_paise),
      mySharePaise: Number(r.my_share_paise),
      expenseCount: r.expense_count,
    }));
  });
}
