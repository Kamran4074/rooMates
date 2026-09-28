import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { env } from "../../config/env";
import { pool, withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { sha256 } from "../../utils/hash";
import { SignupInput, LoginInput } from "./auth.schema";
import { issueOtp, consumeOtp } from "./otp.service";

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  email: string;
  name: string;
  picture?: string;
  onboardingCompleted: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
  if (!googleClient) {
    throw new AppError("Google OAuth is not configured on the server", 500);
  }

  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new AppError("Invalid Google token", 401);
  }

  return {
    googleId: payload.sub,
    email: payload.email,
    name: payload.name ?? payload.email,
    picture: payload.picture,
  };
}

// Runs as app_user but bypasses RLS internally (the DB function is SECURITY
// DEFINER) - this is the one pre-authentication lookup that has to, since we
// don't know the caller's internal user id until this returns it.
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<AuthenticatedUser> {
  const result = await pool.query<{ user_id: string; organization_id: string; onboarding_completed: boolean }>(
    "SELECT * FROM find_or_create_google_user($1, $2, $3, $4)",
    [profile.googleId, profile.email, profile.name, profile.picture ?? null]
  );

  const row = result.rows[0];
  return {
    userId: row.user_id,
    organizationId: row.organization_id,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    onboardingCompleted: row.onboarding_completed,
  };
}

interface EmailLookupRow {
  user_id: string;
  organization_id: string;
  name: string;
  password_hash: string | null;
  onboarding_completed: boolean;
  email_verified: boolean;
}

// Pre-identity lookup through the SECURITY DEFINER function - every
// email-based flow (login, verify, forgot/reset password) starts here.
async function findUserByEmail(email: string): Promise<EmailLookupRow | undefined> {
  const result = await pool.query<EmailLookupRow>("SELECT * FROM get_user_by_email_for_login($1)", [email]);
  return result.rows[0];
}

function toAuthenticatedUser(row: EmailLookupRow, email: string): AuthenticatedUser {
  return {
    userId: row.user_id,
    organizationId: row.organization_id,
    email,
    name: row.name,
    onboardingCompleted: row.onboarding_completed,
  };
}

// Creates the (unverified) account and emails a verification code. No tokens
// are issued here - the account can't be used until the code is confirmed.
export async function signupWithPassword(input: SignupInput): Promise<void> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  let userId: string;
  try {
    const result = await pool.query<{ user_id: string }>("SELECT * FROM create_password_user($1, $2, $3)", [
      input.email,
      passwordHash,
      input.name,
    ]);
    userId = result.rows[0].user_id;
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new AppError("An account with this email already exists", 409);
    }
    throw err;
  }

  await issueOtp(userId, input.email, "email_verification");
}

export async function loginWithPassword(input: LoginInput): Promise<AuthenticatedUser> {
  const row = await findUserByEmail(input.email);

  // Same message whether the email doesn't exist, has no password (e.g. a
  // Google-only account) or the password is wrong - don't leak which.
  if (!row || !row.password_hash || !(await bcrypt.compare(input.password, row.password_hash))) {
    throw new AppError("Invalid email or password", 401);
  }

  // Checked only AFTER the password matches, so this can't be used to probe
  // which emails are registered-but-unverified.
  if (!row.email_verified) {
    await issueOtp(row.user_id, input.email, "email_verification");
    throw new AppError("Please verify your email first. We've sent you a new code.", 403);
  }

  return toAuthenticatedUser(row, input.email);
}

export async function verifyEmail(email: string, code: string): Promise<AuthenticatedUser> {
  const row = await findUserByEmail(email);
  if (!row || row.email_verified || !(await consumeOtp(row.user_id, "email_verification", code))) {
    throw new AppError("Invalid or expired code", 400);
  }

  await withUserContext(row.user_id, (client) =>
    client.query("UPDATE users SET email_verified = true WHERE id = $1", [row.user_id])
  );
  return toAuthenticatedUser(row, email);
}

// Always resolves without error, whether or not the email exists - otherwise
// this endpoint becomes a free "is this email registered?" oracle.
export async function resendVerificationCode(email: string): Promise<void> {
  const row = await findUserByEmail(email);
  if (row && !row.email_verified) {
    await issueOtp(row.user_id, email, "email_verification");
  }
}

export async function requestPasswordReset(email: string): Promise<void> {
  const row = await findUserByEmail(email);
  if (row) {
    await issueOtp(row.user_id, email, "password_reset");
  }
}

// A successful reset also proves email ownership (the code went to that
// inbox), so it marks the email verified too. Every existing session is
// revoked - if the password was reset because it leaked, whoever else was
// signed in with it shouldn't stay signed in.
export async function resetPassword(email: string, code: string, newPassword: string): Promise<AuthenticatedUser> {
  const row = await findUserByEmail(email);
  if (!row || !(await consumeOtp(row.user_id, "password_reset", code))) {
    throw new AppError("Invalid or expired code", 400);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await withUserContext(row.user_id, (client) =>
    client.query("UPDATE users SET password_hash = $1, email_verified = true WHERE id = $2", [
      passwordHash,
      row.user_id,
    ])
  );
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [
    row.user_id,
  ]);

  return toAuthenticatedUser(row, email);
}

export function issueAccessToken(user: AuthenticatedUser): string {
  return jwt.sign(
    { sub: user.userId, organizationId: user.organizationId, email: user.email, name: user.name },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

// The raw refresh token is only ever returned to the client, never stored -
// only its hash lives in the DB, the same trust model as a password. This
// means a leaked database backup can't be used to mint new sessions.
export async function issueRefreshToken(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  await pool.query(
    "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)",
    [userId, tokenHash, expiresAt]
  );

  return rawToken;
}

export async function issueTokenPair(user: AuthenticatedUser): Promise<TokenPair> {
  const [accessToken, refreshToken] = await Promise.all([
    issueAccessToken(user),
    issueRefreshToken(user.userId),
  ]);
  return { accessToken, refreshToken };
}

// Rotation: the presented refresh token is revoked and a brand new one issued
// alongside the new access token, rather than reusing the same refresh token
// indefinitely. If a revoked token is ever presented again, that's a strong
// signal it was stolen and reused - worth flagging even though this MVP
// doesn't yet act on that signal beyond rejecting the request.
export async function rotateRefreshToken(rawToken: string): Promise<TokenPair & { user: AuthenticatedUser }> {
  const tokenHash = sha256(rawToken);

  const result = await pool.query<{ id: string; user_id: string; revoked_at: string | null; expires_at: string }>(
    "SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1",
    [tokenHash]
  );
  const row = result.rows[0];

  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1", [row.id]);

  const user = await withUserContext(row.user_id, async (client) => {
    const userResult = await client.query<{
      id: string;
      organization_id: string;
      email: string;
      name: string;
      onboarding_completed: boolean;
    }>("SELECT id, organization_id, email, name, onboarding_completed FROM users WHERE id = $1", [row.user_id]);
    const u = userResult.rows[0];
    return {
      userId: u.id,
      organizationId: u.organization_id,
      email: u.email,
      name: u.name,
      onboardingCompleted: u.onboarding_completed,
    } satisfies AuthenticatedUser;
  });

  const tokens = await issueTokenPair(user);
  return { ...tokens, user };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = sha256(rawToken);
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [
    tokenHash,
  ]);
}
