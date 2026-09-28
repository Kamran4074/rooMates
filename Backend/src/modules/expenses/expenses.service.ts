import crypto from "crypto";
import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { CreateExpenseInput } from "./expenses.schema";
import { splitEqually, simplifyDebts, Balance } from "../settlement/settlement.algorithm";

const toPaise = (rupees: number) => Math.round(rupees * 100);

export async function createExpense(userId: string, roomId: string, input: CreateExpenseInput) {
  const amountPaise = toPaise(input.amount);
  const expenseId = crypto.randomUUID();

  return withUserContext(userId, async (client) => {
    let splits: { userId: string; sharePaise: number }[];

    if (input.splitType === "equal") {
      const members = await client.query<{ user_id: string }>(
        "SELECT user_id FROM room_members WHERE room_id = $1",
        [roomId]
      );
      if (members.rowCount === 0) {
        throw new AppError("Room has no members to split with", 400);
      }
      splits = splitEqually(
        amountPaise,
        members.rows.map((m) => m.user_id)
      );
    } else {
      splits = input.splits!.map((s) => ({ userId: s.userId, sharePaise: toPaise(s.amount) }));
      const splitTotal = splits.reduce((sum, s) => sum + s.sharePaise, 0);
      if (splitTotal !== amountPaise) {
        throw new AppError(
          `Split amounts (${splitTotal / 100}) must add up to the total expense amount (${amountPaise / 100})`,
          400
        );
      }
    }

    await client.query(
      "INSERT INTO expenses (id, room_id, paid_by, description, amount_paise, created_by) VALUES ($1,$2,$3,$4,$5,$6)",
      [expenseId, roomId, userId, input.description, amountPaise, userId]
    );

    for (const split of splits) {
      await client.query(
        "INSERT INTO expense_splits (expense_id, user_id, share_paise) VALUES ($1,$2,$3)",
        [expenseId, split.userId, split.sharePaise]
      );
    }

    return { id: expenseId, description: input.description, amountPaise, paidBy: userId, splits };
  });
}

export async function listExpenses(userId: string, roomId: string) {
  return withUserContext(userId, async (client) => {
    const expenses = await client.query(
      `SELECT e.id, e.description, e.amount_paise, e.paid_by, e.created_at, u.name AS paid_by_name
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE e.room_id = $1
       ORDER BY e.created_at DESC`,
      [roomId]
    );
    return expenses.rows;
  });
}

export async function getRoomBalances(userId: string, roomId: string) {
  return withUserContext(userId, async (client) => {
    const members = await client.query<{ user_id: string; name: string }>(
      `SELECT rm.user_id, u.name FROM room_members rm JOIN users u ON u.id = rm.user_id WHERE rm.room_id = $1`,
      [roomId]
    );

    const paidTotals = await client.query<{ paid_by: string; total: string }>(
      "SELECT paid_by, SUM(amount_paise) AS total FROM expenses WHERE room_id = $1 GROUP BY paid_by",
      [roomId]
    );
    const owedTotals = await client.query<{ user_id: string; total: string }>(
      `SELECT es.user_id, SUM(es.share_paise) AS total
       FROM expense_splits es
       JOIN expenses e ON e.id = es.expense_id
       WHERE e.room_id = $1
       GROUP BY es.user_id`,
      [roomId]
    );

    const paidMap = new Map(paidTotals.rows.map((r) => [r.paid_by, Number(r.total)]));
    const owedMap = new Map(owedTotals.rows.map((r) => [r.user_id, Number(r.total)]));

    const balances: (Balance & { name: string })[] = members.rows.map((m) => ({
      userId: m.user_id,
      name: m.name,
      netPaise: (paidMap.get(m.user_id) ?? 0) - (owedMap.get(m.user_id) ?? 0),
    }));

    const nameByUserId = new Map(members.rows.map((m) => [m.user_id, m.name]));
    const settlements = simplifyDebts(balances).map((t) => ({
      ...t,
      fromName: nameByUserId.get(t.fromUserId),
      toName: nameByUserId.get(t.toUserId),
    }));

    return { balances, settlements };
  });
}
