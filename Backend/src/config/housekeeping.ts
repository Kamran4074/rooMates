import { adminPool, pool } from "./db";
import { logger } from "./logger";

// otp_codes and refresh_tokens only ever grow: every sign-in, refresh and
// emailed code adds a row. Rows that can never be used again are deleted:
//   - OTP codes that expired or were used more than a day ago
//   - refresh tokens that expired, or were revoked more than a week ago
//     (kept that long so a recently revoked token is still recognisable)
//
// Runs at startup and then once a day, inside the API process. A separate
// cron service would be overkill for two DELETE statements.
const DAY = 24 * 60 * 60 * 1000;

export async function deleteStaleAuthRows() {
  const otps = await pool.query(
    "DELETE FROM otp_codes WHERE expires_at < now() - interval '1 day' OR consumed_at < now() - interval '1 day'"
  );
  const tokens = await pool.query(
    "DELETE FROM refresh_tokens WHERE expires_at < now() OR revoked_at < now() - interval '7 days'"
  );
  if (otps.rowCount || tokens.rowCount) {
    logger.info("Housekeeping: removed stale auth rows", { otpCodes: otps.rowCount, refreshTokens: tokens.rowCount });
  }
}

// A paid plan bought for a month or a year ends on plan_expires_at: back to
// Basic limits. Rooms and data stay; only what Basic doesn't allow is locked
// (new funds, bill sections, Find a room) and rooms can't grow past 4.
export async function expirePlans() {
  const { rows } = await adminPool.query<{ id: string }>(
    `UPDATE organizations o
     SET plan = 'basic', max_rooms = p.max_rooms, max_members_per_room = p.max_members_per_room, plan_expires_at = NULL
     FROM plan_catalog p
     WHERE p.id = 'basic' AND o.plan_expires_at <= now()
     RETURNING o.id`
  );
  if (rows.length) logger.info("Housekeeping: plans expired, moved to basic", { organizations: rows.map((r) => r.id) });
  return rows.length;
}

const HOUR = 60 * 60 * 1000;

export function scheduleHousekeeping() {
  const warn = (err: unknown) => logger.warn("Housekeeping failed", { error: (err as Error).message });
  const daily = () => deleteStaleAuthRows().catch(warn);
  const hourly = () => expirePlans().catch(warn);
  daily();
  hourly();
  // unref: these timers alone never keep the process alive (graceful shutdown still works).
  setInterval(daily, DAY).unref();
  setInterval(hourly, HOUR).unref();
}
