import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { toPaise } from "../../utils/money";
import { PageParams, paginate, toLimitOffset } from "../../utils/pagination";
import { getMemberIds, requireMember } from "../rooms/rooms.repository";
import { todayInIndia } from "../expenses/expenses.schema";
import { CreateSettlementInput } from "./settlements.schema";

// Recorded settle-up payments. They feed the same room_ledger view as
// expenses, so balances move the moment one is saved.
// (The debt-simplification algorithm that suggests them lives in ../settlement.)

export async function createSettlement(userId: string, roomId: string, input: CreateSettlementInput) {
  return withUserContext(userId, async (client) => {
    const role = await requireMember(client, roomId, userId);
    const memberIds = new Set(await getMemberIds(client, roomId));
    if (!memberIds.has(input.fromUserId) || !memberIds.has(input.toUserId)) {
      throw new AppError("Both people must be members of this room", 400);
    }
    // One of the two people involved records it, or the room admin does.
    // The RLS insert policy enforces the same rule.
    if (userId !== input.fromUserId && userId !== input.toUserId && role !== "admin") {
      throw new AppError("Only the people involved or the room admin can record this payment", 403);
    }

    const amountPaise = toPaise(input.amount);
    const settledOn = input.settledOn ?? todayInIndia();
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO settlements (room_id, from_user_id, to_user_id, amount_paise, settled_on, note, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [roomId, input.fromUserId, input.toUserId, amountPaise, settledOn, input.note || null, userId]
    );
    return { id: rows[0].id, fromUserId: input.fromUserId, toUserId: input.toUserId, amountPaise, settledOn };
  });
}

export async function listSettlements(userId: string, roomId: string, params: PageParams) {
  return withUserContext(userId, async (client) => {
    await requireMember(client, roomId, userId);
    const { limit, offset } = toLimitOffset(params);
    // LEFT JOIN: RLS hides a former member's user row; the payment stays.
    const { rows } = await client.query(
      `SELECT s.id, s.from_user_id, COALESCE(f.name, 'Former member') AS from_name,
              s.to_user_id, COALESCE(t.name, 'Former member') AS to_name,
              s.amount_paise::float8 AS amount_paise, s.settled_on::text AS settled_on, s.note,
              s.created_by, s.created_at, COUNT(*) OVER() AS total_count
       FROM settlements s
       LEFT JOIN users f ON f.id = s.from_user_id
       LEFT JOIN users t ON t.id = s.to_user_id
       WHERE s.room_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.settled_on DESC, s.created_at DESC
       LIMIT $2 OFFSET $3`,
      [roomId, limit, offset]
    );
    return paginate(rows, params);
  });
}

// Soft delete, same rule as expenses: whoever recorded it or the room admin.
export async function deleteSettlement(userId: string, roomId: string, settlementId: string) {
  return withUserContext(userId, async (client) => {
    const role = await requireMember(client, roomId, userId);
    const { rows } = await client.query<{ created_by: string }>(
      "SELECT created_by FROM settlements WHERE id = $1 AND room_id = $2 AND deleted_at IS NULL",
      [settlementId, roomId]
    );
    if (!rows[0]) throw new AppError("Payment not found", 404);
    if (rows[0].created_by !== userId && role !== "admin") {
      throw new AppError("Only whoever recorded this payment or the room admin can delete it", 403);
    }
    await client.query("UPDATE settlements SET deleted_at = now(), deleted_by = $2 WHERE id = $1", [settlementId, userId]);
  });
}
