import { pool } from "./db";
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

export function scheduleHousekeeping() {
  const run = () =>
    deleteStaleAuthRows().catch((err) => logger.warn("Housekeeping failed", { error: (err as Error).message }));
  run();
  // unref: this timer alone never keeps the process alive (graceful shutdown still works).
  setInterval(run, DAY).unref();
}
