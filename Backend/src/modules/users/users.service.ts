import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { ProfileInput } from "./users.schema";

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
              o.plan, o.max_rooms, count_org_rooms(o.id) AS room_count
       FROM users u
       JOIN organizations o ON o.id = u.organization_id
       WHERE u.id = $1`,
      [userId]
    );
    return result.rows[0];
  });
}
