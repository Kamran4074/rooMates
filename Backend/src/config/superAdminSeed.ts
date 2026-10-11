import bcrypt from "bcryptjs";
import { env } from "./env";
import { logger } from "./logger";
import { withAdminTransaction } from "./db";

// The super admin, defined by the environment (Render -> Environment):
//   SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD, SUPER_ADMIN_NAME (optional)
// Applied on every start, after migrations. Idempotent:
//  - no account with that email -> created (verified, super_admin, onboarding done);
//  - account exists -> made super_admin, verified and un-suspended;
//  - the password differs from SUPER_ADMIN_PASSWORD -> set, and that account
//    is signed out everywhere (its refresh tokens are revoked);
//  - any OTHER super_admin account -> demoted to a regular user, so changing
//    SUPER_ADMIN_EMAIL moves the role instead of adding a second admin.
// Forgot the password, or new admin email? Change the variable on Render; the
// restart applies it. The env value wins over a password changed in the app.
// It never stops the server: a bad config is logged and skipped.

export interface SuperAdminConfig {
  email?: string;
  password?: string;
  name: string;
}

export type SeedResult = "skipped" | "created" | "updated" | "unchanged";

const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_COST = 12;

export async function seedSuperAdmin(
  config: SuperAdminConfig = {
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD,
    name: env.SUPER_ADMIN_NAME,
  }
): Promise<SeedResult> {
  const { email, password, name } = config;
  if (!email && !password) return "skipped";
  if (!email || !password) {
    logger.error("Super admin seed skipped: set both SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD, or neither");
    return "skipped";
  }
  // bcrypt only uses the first 72 bytes, so a longer password wouldn't be fully checked.
  if (password.length < MIN_PASSWORD_LENGTH || Buffer.byteLength(password, "utf8") > 72) {
    logger.error(`Super admin seed skipped: SUPER_ADMIN_PASSWORD must be ${MIN_PASSWORD_LENGTH}-72 characters`);
    return "skipped";
  }

  try {
    return await withAdminTransaction(async (client) => {
      // Only one super admin: whoever SUPER_ADMIN_EMAIL names.
      const demoted = await client.query(
        "UPDATE users SET role = 'user' WHERE role = 'super_admin' AND email <> $1 RETURNING id",
        [email]
      );
      if (demoted.rowCount) logger.warn("Super admin role removed from accounts other than SUPER_ADMIN_EMAIL", { count: demoted.rowCount });

      const { rows } = await client.query<{ id: string; password_hash: string | null; role: string }>(
        "SELECT id, password_hash, role FROM users WHERE email = $1 FOR UPDATE",
        [email]
      );
      const user = rows[0];

      if (!user) {
        const org = await client.query<{ id: string }>("INSERT INTO organizations (name) VALUES ($1) RETURNING id", [
          `${name}'s organization`,
        ]);
        // An operator account skips onboarding (phone number, first room).
        await client.query(
          `INSERT INTO users (organization_id, email, name, password_hash, email_verified, role, onboarding_completed)
           VALUES ($1, $2, $3, $4, true, 'super_admin', true)`,
          [org.rows[0].id, email, name, await bcrypt.hash(password, BCRYPT_COST)]
        );
        logger.info("Super admin account created from SUPER_ADMIN_EMAIL");
        return "created";
      }

      const passwordChanged = !user.password_hash || !(await bcrypt.compare(password, user.password_hash));
      const { rowCount } = await client.query(
        `UPDATE users SET role = 'super_admin', email_verified = true, suspended_at = NULL,
                password_hash = COALESCE($2, password_hash)
         WHERE id = $1
           AND (role <> 'super_admin' OR NOT email_verified OR suspended_at IS NOT NULL OR $2::text IS NOT NULL)`,
        [user.id, passwordChanged ? await bcrypt.hash(password, BCRYPT_COST) : null]
      );
      if (passwordChanged) {
        await client.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [user.id]);
      }

      if (!rowCount && !demoted.rowCount) return "unchanged";
      logger.info("Super admin account updated from env", {
        madeSuperAdmin: user.role !== "super_admin",
        passwordReset: passwordChanged,
      });
      return "updated";
    });
  } catch (err) {
    logger.error("Super admin seed failed", { error: (err as Error).message });
    return "skipped";
  }
}
