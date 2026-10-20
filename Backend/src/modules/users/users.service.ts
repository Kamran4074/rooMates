import bcrypt from "bcryptjs";
import { withAdminTransaction, withUserContext } from "../../config/db";
import { logger } from "../../config/logger";
import { AppError } from "../../middlewares/errorHandler";
import { anonymiseAccount } from "./accountDeletion";
import { DeleteAccountInput, ProfileInput } from "./users.schema";

const PROFILE_COLUMNS = "id, email, name, phone, picture, onboarding_completed";

async function saveProfile(userId: string, input: ProfileInput, completeOnboarding: boolean) {
  try {
    return await withUserContext(userId, async (client) => {
      const result = await client.query(
        `UPDATE users
         SET name = $1, phone = $2, onboarding_completed = onboarding_completed OR $3::boolean
         WHERE id = $4
         RETURNING ${PROFILE_COLUMNS}`,
        [input.name, input.phone, completeOnboarding, userId]
      );
      return result.rows[0];
    });
  } catch (err) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr.code === "23505" && pgErr.constraint === "users_phone_unique") {
      throw new AppError("This phone number is already linked to another account", 409);
    }
    throw err;
  }
}

export const completeOnboarding = (userId: string, input: ProfileInput) => saveProfile(userId, input, true);

export const updateProfile = (userId: string, input: ProfileInput) => saveProfile(userId, input, false);

// Profile plus plan usage for the dashboard. Room count goes through the
// count_org_rooms SECURITY DEFINER function so it matches the quota check
// exactly (plain RLS would only count rooms this user is a member of).
export async function getMe(userId: string) {
  return withUserContext(userId, async (client) => {
    const result = await client.query(
      `SELECT u.id, u.email, u.name, u.phone, u.picture, u.onboarding_completed,
              u.password_hash IS NOT NULL AS has_password,
              o.plan, o.plan_expires_at, o.max_rooms, o.max_members_per_room, count_org_rooms(o.id) AS room_count
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0];
  });
}

// The user's own "Delete account" - same rules as the super admin's delete
// (anonymiseAccount). Accounts with a password must re-enter it; Google-only
// accounts have none, so typing DELETE is their confirmation. Logged in
// audit_logs with the user as the actor, so support can see who deleted it.
export async function deleteOwnAccount(userId: string, input: DeleteAccountInput) {
  return withAdminTransaction(async (client) => {
    const { rows } = await client.query<{ password_hash: string | null }>(
      "SELECT password_hash FROM users WHERE id = $1",
      [userId]
    );
    const hash = rows[0]?.password_hash;
    if (hash && !(input.password && (await bcrypt.compare(input.password, hash)))) {
      // 400, not 401: a 401 would make the app think the session expired.
      throw new AppError("That password isn't right", 400);
    }

    const summary = await anonymiseAccount(client, userId, true);
    await client.query(
      "INSERT INTO audit_logs (admin_id, action, entity_type, entity_id, details) VALUES ($1, $2, 'user', $1, $3)",
      [userId, "DELETED_OWN_ACCOUNT", JSON.stringify(summary)]
    );
    logger.info("Account deleted by its owner", { userId });
    return { deleted: true };
  });
}
