import { PoolClient } from "pg";
import { AppError } from "../../middlewares/errorHandler";

// "Delete" = anonymise. The row stays because other people's expenses and
// payments reference it; everything personal goes, and nobody can sign in.
// Refused while they still owe or are owed money in any room - deleting them
// then would leave the others' balances not adding up.
// Their rooms: a room only they were in is deleted; a room they ran gets the
// longest-standing member as its new admin. Their listings are taken down and
// their requests to other listings removed.
//
// Shared by the super admin's delete and the user's own "Delete account", so
// both follow exactly the same rules. Must run on the owner connection
// (withAdminTransaction): it touches rooms and listings RLS would hide.
// `self` only changes the wording of the errors.
export async function anonymiseAccount(client: PoolClient, userId: string, self: boolean) {
  const { rows } = await client.query<{ role: string; deleted_at: Date | null }>(
    "SELECT role, deleted_at FROM users WHERE id = $1 FOR UPDATE",
    [userId]
  );
  const user = rows[0];
  if (!user) throw new AppError("User not found", 404);
  if (user.deleted_at) throw new AppError("This account is already deleted", 409);
  if (user.role === "super_admin") {
    throw new AppError("The super admin is set by SUPER_ADMIN_EMAIL on the server; change it there first", 403);
  }

  const unsettled = await client.query<{ name: string }>(
    `SELECT r.name FROM room_ledger l JOIN rooms r ON r.id = l.room_id
     WHERE l.user_id = $1 GROUP BY r.id, r.name HAVING SUM(l.amount_paise) <> 0`,
    [userId]
  );
  if (unsettled.rows.length) {
    const rooms = unsettled.rows.map((r) => r.name).join(", ");
    throw new AppError(
      self
        ? `You still have money to settle in: ${rooms}. Settle up first, then delete your account.`
        : `They still have money to settle in: ${rooms}. Settle up first.`,
      409
    );
  }

  const soloRooms = await client.query(
    `DELETE FROM rooms r
     WHERE r.id IN (SELECT room_id FROM room_members WHERE user_id = $1)
       AND NOT EXISTS (SELECT 1 FROM room_members m WHERE m.room_id = r.id AND m.user_id <> $1)
     RETURNING r.id`,
    [userId]
  );
  const left = await client.query<{ room_id: string; role: string }>(
    "DELETE FROM room_members WHERE user_id = $1 RETURNING room_id, role",
    [userId]
  );
  const adminRooms = left.rows.filter((r) => r.role === "admin").map((r) => r.room_id);
  for (const roomId of adminRooms) {
    await client.query(
      `UPDATE room_members SET role = 'admin'
       WHERE room_id = $1
         AND user_id = (SELECT user_id FROM room_members WHERE room_id = $1 ORDER BY joined_at LIMIT 1)`,
      [roomId]
    );
  }

  const listings = await client.query(
    `UPDATE listings SET status = 'removed', rejection_reason = 'The owner''s account was deleted'
     WHERE owner_id = $1 AND status NOT IN ('removed', 'rented')`,
    [userId]
  );
  await client.query("DELETE FROM listing_requests WHERE requester_id = $1", [userId]);
  await client.query("DELETE FROM otp_codes WHERE user_id = $1", [userId]);
  await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  await client.query(
    `UPDATE users SET name = 'Deleted user', email = 'deleted-' || id || '@deleted.invalid',
            phone = NULL, picture = NULL, google_id = NULL, password_hash = NULL,
            email_verified = false, deleted_at = now()
     WHERE id = $1`,
    [userId]
  );

  return {
    roomsDeleted: soloRooms.rowCount ?? 0,
    roomsLeft: left.rows.length,
    adminHandedOver: adminRooms.length,
    listingsRemoved: listings.rowCount ?? 0,
  };
}
