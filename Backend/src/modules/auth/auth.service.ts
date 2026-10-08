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
  role?: PlatformRole;
}

export type PlatformRole = "user" | "super_admin";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

// The frontend uses Google's popup token flow (our own button opens it), which
// yields an ACCESS token rather than an ID token. Unlike an ID token it isn't
// self-verifying, so we ask Google about it.
export async function verifyGoogleAccessToken(accessToken: string): Promise<GoogleProfile> {
  if (!googleClient) {
    throw new AppError("Google OAuth is not configured on the server", 500);
  }

  let info;
  try {
    info = await googleClient.getTokenInfo(accessToken);
  } catch {
    throw new AppError("Invalid Google token", 401);
  }

  // The critical check: the token must have been issued to OUR client. Any
  // other site using Google sign-in also receives access tokens for its
  // users; without this, it could replay one here and log in as that user.
  if (info.aud !== env.GOOGLE_CLIENT_ID || !info.sub || !info.email) {
    throw new AppError("Invalid Google token", 401);
  }
  // Google sign-in links to an existing account by email, so the email must
  // be one Google has actually confirmed.
  if (!info.email_verified) {
    throw new AppError("Your Google account's email isn't verified", 401);
  }

  // Name and photo aren't in tokeninfo. They're cosmetic, so a failure here
  // falls back to the email rather than failing the sign-in.
  type UserInfo = { name?: string; picture?: string };
  const profile: UserInfo = await fetch(GOOGLE_USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
    .then((res) => (res.ok ? (res.json() as Promise<UserInfo>) : {}))
    .catch(() => ({}));

  return {
    googleId: info.sub,
    email: info.email.toLowerCase(),
    name: profile.name ?? info.email,
    picture: profile.picture,
  };
}

// Runs as app_user but bypasses RLS internally (the DB function is SECURITY
// DEFINER) - this is the one pre-authentication lookup that has to, since we
// don't know the caller's internal user id until this returns it. An existing
// email/password account with the same email gets linked, not duplicated.
export async function findOrCreateGoogleUser(profile: GoogleProfile): Promise<AuthenticatedUser> {
  let result;
  try {
    result = await pool.query<{ user_id: string; organization_id: string; onboarding_completed: boolean }>(
      "SELECT * FROM find_or_create_google_user($1, $2, $3, $4)",
      [profile.googleId, profile.email, profile.name, profile.picture ?? null]
    );
  } catch (err) {
    if ((err as { code?: string }).code === "23505") {
      throw new AppError("This email is already linked to a different Google account", 409);
    }
    throw err;
  }

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
export async function signupWithPassword(input: SignupInput): Promise<string> {
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
    if ((err as { code?: string }).code !== "23505") throw err;

    // Signed up before but never entered the code (closed the tab, code
    // expired): let them start over rather than dead-ending on "already
    // exists". The latest details win; only the inbox owner can verify.
    const existing = await findUserByEmail(input.email);
    if (!existing || existing.email_verified) {
      throw new AppError("An account with this email already exists. Sign in instead.", 409);
    }
    userId = existing.user_id;
    await withUserContext(userId, (client) =>
      client.query("UPDATE users SET password_hash = $1, name = $2 WHERE id = $3", [passwordHash, input.name, userId])
    );
  }

  await issueOtp(userId, input.email, "email_verification");
  return userId;
}

// Compared against when the email has no password, so a login for an unknown
// email takes as long as one with a wrong password - otherwise response time
// alone would reveal which emails are registered.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("roomates-timing-equaliser", 10);

export async function loginWithPassword(input: LoginInput): Promise<AuthenticatedUser> {
  const row = await findUserByEmail(input.email);
  const passwordMatches = await bcrypt.compare(input.password, row?.password_hash ?? DUMMY_PASSWORD_HASH);

  // Same message whether the email doesn't exist, has no password (e.g. a
  // Google-only account) or the password is wrong - don't leak which.
  if (!row || !row.password_hash || !passwordMatches) {
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
    { algorithm: "HS256", expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as jwt.SignOptions["expiresIn"] }
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

// The one gate every sign-in passes through (password, Google, verify-email,
// reset-password), so a suspended account can't get a session by any route.
// Returns the role so the client can show admin UI - the server still checks
// the role again on every admin request.
//
// It also stamps last_active_at (for the admin's "last active" column). Every
// session refresh passes through here too, so an open app updates it about
// every 15 minutes - without a write on every API request.
export async function assertActiveAccount(userId: string): Promise<PlatformRole> {
  return withUserContext(userId, async (client) => {
    const { rows } = await client.query<{ role: PlatformRole; suspended_at: Date | null; deleted_at: Date | null }>(
      "SELECT role, suspended_at, deleted_at FROM users WHERE id = $1",
      [userId]
    );
    if (!rows[0] || rows[0].deleted_at) throw new AppError("Account not found", 401);
    if (rows[0].suspended_at) throw new AppError("This account has been suspended. Contact support.", 403);
    await client.query(
      `UPDATE users SET last_active_at = now()
       WHERE id = $1 AND (last_active_at IS NULL OR last_active_at < now() - interval '5 minutes')`,
      [userId]
    );
    return rows[0].role;
  });
}

export async function issueTokenPair(user: AuthenticatedUser): Promise<TokenPair & { role: PlatformRole }> {
  const role = await assertActiveAccount(user.userId);
  return { accessToken: issueAccessToken(user), refreshToken: await issueRefreshToken(user.userId), role };
}

// Rotation: the presented refresh token is revoked and a brand new one issued
// alongside the new access token, rather than reusing the same refresh token
// indefinitely. Check-and-revoke is ONE conditional UPDATE, so two concurrent
// requests with the same token can't both win - only one row update succeeds.
export async function rotateRefreshToken(rawToken: string): Promise<TokenPair & { user: AuthenticatedUser }> {
  const revoked = await pool.query<{ user_id: string }>(
    `UPDATE refresh_tokens SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
     RETURNING user_id`,
    [sha256(rawToken)]
  );
  const userId = revoked.rows[0]?.user_id;
  if (!userId) {
    throw new AppError("Invalid or expired refresh token", 401);
  }

  const user = await withUserContext(userId, async (client) => {
    const { rows } = await client.query<{
      id: string;
      organization_id: string;
      email: string;
      name: string;
      picture: string | null;
      onboarding_completed: boolean;
    }>("SELECT id, organization_id, email, name, picture, onboarding_completed FROM users WHERE id = $1", [
      userId,
    ]);
    const u = rows[0];
    return {
      userId: u.id,
      organizationId: u.organization_id,
      email: u.email,
      name: u.name,
      picture: u.picture ?? undefined,
      onboardingCompleted: u.onboarding_completed,
    } satisfies AuthenticatedUser;
  });

  // issueTokenPair re-checks suspension: the old token is already revoked
  // above, so a suspended user is fully signed out here.
  const { role, ...tokens } = await issueTokenPair(user);
  return { ...tokens, user: { ...user, role } };
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await pool.query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [
    sha256(rawToken),
  ]);
}
