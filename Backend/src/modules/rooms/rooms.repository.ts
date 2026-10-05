import { PoolClient } from "pg";
import { AppError } from "../../middlewares/errorHandler";

// Room-membership lookups shared by the rooms, expenses and funds services.
// They take the transaction's client (from withUserContext), so they run under
// the caller's RLS context: a room you're not in simply has no rows, which is
// why "not a member" and "doesn't exist" are both a 404.

export type RoomRole = "admin" | "member";

export async function getMemberIds(client: PoolClient, roomId: string): Promise<string[]> {
  const { rows } = await client.query<{ user_id: string }>(
    "SELECT user_id FROM room_members WHERE room_id = $1 ORDER BY joined_at",
    [roomId]
  );
  if (rows.length === 0) throw new AppError("Room not found", 404);
  return rows.map((r) => r.user_id);
}

export async function requireMember(client: PoolClient, roomId: string, userId: string): Promise<RoomRole> {
  const { rows } = await client.query<{ role: RoomRole }>(
    "SELECT role FROM room_members WHERE room_id = $1 AND user_id = $2",
    [roomId, userId]
  );
  if (!rows[0]) throw new AppError("Room not found", 404);
  return rows[0].role;
}

export async function requireRoomAdmin(client: PoolClient, roomId: string, userId: string): Promise<void> {
  if ((await requireMember(client, roomId, userId)) !== "admin") {
    throw new AppError("Only the room admin can do this", 403);
  }
}
