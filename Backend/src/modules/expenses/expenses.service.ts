import crypto from "crypto";
import { PoolClient } from "pg";
import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { CreateExpenseInput, MonthExpensesQuery, todayInIndia } from "./expenses.schema";
import { splitEqually, simplifyDebts, Balance } from "../settlement/settlement.algorithm";
import { toPaise } from "../../utils/money";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";
import { getMemberIds, requireMember } from "../rooms/rooms.repository";
import { getCategory } from "../categories/categories.service";

export async function createExpense(userId: string, roomId: string, input: CreateExpenseInput) {
  const amountPaise = toPaise(input.amount);
  const expenseId = crypto.randomUUID();

  return withUserContext(userId, async (client) => {
    // RLS hides rooms the caller isn't in, so this 404s for someone else's room.
    const memberIds = new Set(await getMemberIds(client, roomId));

    // Anyone in the room can record that someone else paid ("Bhavya bought the
    // milk"), like in Splitwise; the payer just has to be in the room.
    const paidBy = input.paidBy ?? userId;
    if (!memberIds.has(paidBy)) throw new AppError("Whoever paid must be a member of this room", 400);
    const expenseDate = input.expenseDate ?? todayInIndia();

    // A section (Rent, Groceries...) decides who shares the bill by default.
    const category = input.categoryId ? await getCategory(client, roomId, input.categoryId) : null;

    let splits: { userId: string; sharePaise: number }[];
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

    await client.query(
      `INSERT INTO expenses (id, room_id, paid_by, description, amount_paise, expense_date, created_by, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [expenseId, roomId, paidBy, input.description, amountPaise, expenseDate, userId, category?.id ?? null]
    );

    // One round trip for all shares instead of one INSERT per member.
    await client.query(
      `INSERT INTO expense_splits (expense_id, user_id, share_paise)
       SELECT $1, s.user_id, s.share_paise FROM unnest($2::uuid[], $3::bigint[]) AS s(user_id, share_paise)`,
      [expenseId, splits.map((s) => s.userId), splits.map((s) => s.sharePaise)]
    );

    return { id: expenseId, description: input.description, amountPaise, paidBy, expenseDate, categoryId: category?.id ?? null, splits };
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
              e.created_by, COALESCE(u.name, 'Former member') AS paid_by_name,
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
