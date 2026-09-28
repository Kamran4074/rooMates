import crypto from "crypto";
import { pool, withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { CreateRoomInput } from "./rooms.schema";

// Excludes visually ambiguous characters (0/O, 1/I/L) since people type this by hand.
const INVITE_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateInviteCode(length = 8): string {
  return Array.from(crypto.randomBytes(length))
    .map((b) => INVITE_CODE_CHARS[b % INVITE_CODE_CHARS.length])
    .join("");
}

const FREE_TIER_MAX_ROOMS = 2;

export async function createRoom(userId: string, organizationId: string, input: CreateRoomInput) {
  const roomId = crypto.randomUUID();
  const inviteCode = generateInviteCode();

  return withUserContext(userId, async (client) => {
    // count_org_rooms bypasses RLS deliberately - a quota check has to see
    // every room the org owns, not just the ones this user is a member of.
    // The organizations lookup below still goes through normal RLS (it works
    // here because app.current_user_id is set for this transaction, so
    // current_user_org_id() resolves and organizations_select passes).
    const countResult = await client.query<{ count_org_rooms: number }>(
      "SELECT count_org_rooms($1)",
      [organizationId]
    );
    const orgResult = await client.query<{ max_rooms: number; plan: string }>(
      "SELECT max_rooms, plan FROM organizations WHERE id = $1",
      [organizationId]
    );
    const maxRooms = orgResult.rows[0]?.max_rooms ?? FREE_TIER_MAX_ROOMS;
    const currentCount = countResult.rows[0].count_org_rooms;

    if (currentCount >= maxRooms) {
      throw new AppError(
        `Room limit reached (${maxRooms} rooms on the ${orgResult.rows[0]?.plan ?? "free"} plan). Upgrade to create more.`,
        403
      );
    }

    await client.query(
      "INSERT INTO rooms (id, organization_id, name, type, invite_code, created_by) VALUES ($1,$2,$3,$4,$5,$6)",
      [roomId, organizationId, input.name, input.type, inviteCode, userId]
    );
    await client.query(
      "INSERT INTO room_members (room_id, user_id, role) VALUES ($1,$2,'admin')",
      [roomId, userId]
    );
    return { id: roomId, name: input.name, type: input.type, inviteCode };
  });
}

export async function joinRoom(userId: string, inviteCode: string) {
  const found = await pool.query<{ room_id: string; name: string; type: string }>(
    "SELECT * FROM find_room_by_invite_code($1)",
    [inviteCode]
  );
  const room = found.rows[0];
  if (!room) {
    throw new AppError("Invalid invite code", 404);
  }

  try {
    await withUserContext(userId, (client) =>
      client.query("INSERT INTO room_members (room_id, user_id, role) VALUES ($1,$2,'member')", [
        room.room_id,
        userId,
      ])
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new AppError("You're already a member of this room", 409);
    }
    throw err;
  }

  return { id: room.room_id, name: room.name, type: room.type };
}

export async function listMyRooms(userId: string) {
  // No WHERE clause needed here - rooms_select RLS already restricts this to
  // rooms the caller is a member of. This is the actual payoff of doing RLS
  // properly: the query can't accidentally leak another tenant's rooms.
  return withUserContext(userId, async (client) => {
    const result = await client.query(
      "SELECT id, name, type, invite_code, created_by, created_at FROM rooms ORDER BY created_at DESC"
    );
    return result.rows;
  });
}

export async function getRoomById(userId: string, roomId: string) {
  return withUserContext(userId, async (client) => {
    const result = await client.query(
      "SELECT id, name, type, invite_code, created_by, created_at FROM rooms WHERE id = $1",
      [roomId]
    );
    const room = result.rows[0];
    if (!room) {
      throw new AppError("Room not found", 404);
    }
    return room;
  });
}

export async function listRoomMembers(userId: string, roomId: string) {
  return withUserContext(userId, async (client) => {
    const result = await client.query(
      `SELECT rm.user_id, rm.role, rm.joined_at, u.name, u.email, u.picture
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = $1
       ORDER BY rm.joined_at ASC`,
      [roomId]
    );
    return result.rows;
  });
}
