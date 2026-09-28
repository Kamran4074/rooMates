import crypto from "crypto";
import { pool } from "../../config/db";
import { sendEmail } from "../../config/email";
import { sha256, safeEqualHex } from "../../utils/hash";

export type OtpPurpose = "email_verification" | "password_reset";

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

const EMAIL_COPY: Record<OtpPurpose, { subject: string; heading: string; body: string }> = {
  email_verification: {
    subject: "Verify your RooMates account",
    heading: "Verify your email",
    body: "Use this code to finish creating your RooMates account.",
  },
  password_reset: {
    subject: "Reset your RooMates password",
    heading: "Reset your password",
    body: "Use this code to set a new password. If you didn't ask for this, you can ignore this email.",
  },
};

function otpEmailHtml(code: string, purpose: OtpPurpose) {
  const copy = EMAIL_COPY[purpose];
  return `
    <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;background:#faf7f0;border-radius:12px">
      <h2 style="color:#1f3a5f;margin:0 0 8px">${copy.heading}</h2>
      <p style="color:#20293a;margin:0 0 20px">${copy.body}</p>
      <div style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#3d8b92;text-align:center;padding:16px;background:#fff;border-radius:8px">${code}</div>
      <p style="color:#888;font-size:12px;margin-top:20px">This code expires in ${OTP_TTL_MINUTES} minutes.</p>
    </div>`;
}

// Issues a fresh code and emails it. Any earlier unused code for the same
// purpose is invalidated so only the latest one works. Within the cooldown
// window this silently does nothing - it stops the endpoint being used to
// spam someone's inbox, without revealing whether the account exists.
export async function issueOtp(userId: string, email: string, purpose: OtpPurpose): Promise<void> {
  const recent = await pool.query(
    `SELECT 1 FROM otp_codes
     WHERE user_id = $1 AND purpose = $2 AND created_at > now() - make_interval(secs => $3)`,
    [userId, purpose, RESEND_COOLDOWN_SECONDS]
  );
  if (recent.rowCount) return;

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

  await pool.query(
    "UPDATE otp_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL",
    [userId, purpose]
  );
  await pool.query(
    `INSERT INTO otp_codes (user_id, purpose, code_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, purpose, sha256(code), OTP_TTL_MINUTES]
  );

  await sendEmail({ to: email, subject: EMAIL_COPY[purpose].subject, html: otpEmailHtml(code, purpose) });
}

// Returns true exactly once per valid code. Wrong guesses count against a
// small attempt budget (a 6-digit code is only 1M possibilities), and the
// final UPDATE ... WHERE consumed_at IS NULL makes consumption atomic, so two
// concurrent requests with the same correct code can't both succeed.
export async function consumeOtp(userId: string, purpose: OtpPurpose, code: string): Promise<boolean> {
  const { rows } = await pool.query<{ id: string; code_hash: string; attempts: number; expires_at: string }>(
    `SELECT id, code_hash, attempts, expires_at FROM otp_codes
     WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose]
  );
  const otp = rows[0];
  if (!otp || new Date(otp.expires_at) < new Date() || otp.attempts >= MAX_ATTEMPTS) return false;

  if (!safeEqualHex(otp.code_hash, sha256(code))) {
    await pool.query("UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1", [otp.id]);
    return false;
  }

  const consumed = await pool.query(
    "UPDATE otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL",
    [otp.id]
  );
  return consumed.rowCount === 1;
}
