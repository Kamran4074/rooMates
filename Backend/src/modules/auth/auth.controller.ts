import { Request, Response } from "express";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import {
  googleLoginSchema,
  signupSchema,
  loginSchema,
  emailOnlySchema,
  verifyEmailSchema,
  resetPasswordSchema,
} from "./auth.schema";
import {
  verifyGoogleAccessToken,
  findOrCreateGoogleUser,
  signupWithPassword,
  loginWithPassword,
  verifyEmail,
  resendVerificationCode,
  requestPasswordReset,
  resetPassword,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  AuthenticatedUser,
} from "./auth.service";
import { logger } from "../../config/logger";
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from "../../config/authCookie";
import { AppError } from "../../middlewares/errorHandler";

// Express 5 forwards rejected promises to the error middleware, so these are
// plain async handlers with no try/catch wrapper.
type Handler = (req: Request, res: Response) => Promise<void>;

function userResponse(user: AuthenticatedUser) {
  return {
    id: user.userId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    onboardingCompleted: user.onboardingCompleted,
    role: user.role ?? "user",
  };
}

// Every flow that ends in "you're now signed in" responds the same way: the
// refresh token goes into the httpOnly cookie, never into the JSON body.
async function sendSession(res: Response, user: AuthenticatedUser) {
  const { role, refreshToken, refreshExpiresAt, accessToken } = await issueTokenPair(user);
  setRefreshCookie(res, refreshToken, refreshExpiresAt);
  sendSuccess(res, { accessToken, user: userResponse({ ...user, role }) });
}

export const googleLogin: Handler = async (req, res) => {
  const { accessToken } = googleLoginSchema.parse(req.body);
  const user = await findOrCreateGoogleUser(await verifyGoogleAccessToken(accessToken));
  logger.info("User logged in via Google", { userId: user.userId });
  await sendSession(res, user);
};

export const signup: Handler = async (req, res) => {
  const input = signupSchema.parse(req.body);
  // Log the id, not the email: logs shouldn't carry personal data.
  const userId = await signupWithPassword(input);
  logger.info("User signed up, verification pending", { userId });
  sendCreated(res, { requiresVerification: true, email: input.email }, "Check your email for a verification code");
};

export const login: Handler = async (req, res) => {
  const user = await loginWithPassword(loginSchema.parse(req.body));
  logger.info("User logged in with password", { userId: user.userId });
  await sendSession(res, user);
};

export const verifyEmailHandler: Handler = async (req, res) => {
  const { email, code } = verifyEmailSchema.parse(req.body);
  const user = await verifyEmail(email, code);
  logger.info("Email verified", { userId: user.userId });
  await sendSession(res, user);
};

export const resendVerification: Handler = async (req, res) => {
  await resendVerificationCode(emailOnlySchema.parse(req.body).email);
  sendSuccess(res, null, { message: "If that account needs verification, a new code has been sent." });
};

export const forgotPassword: Handler = async (req, res) => {
  await requestPasswordReset(emailOnlySchema.parse(req.body).email);
  sendSuccess(res, null, { message: "If an account exists for that email, a reset code has been sent." });
};

export const resetPasswordHandler: Handler = async (req, res) => {
  const { email, code, newPassword } = resetPasswordSchema.parse(req.body);
  const user = await resetPassword(email, code, newPassword);
  logger.info("Password reset", { userId: user.userId });
  await sendSession(res, user);
};

export const refresh: Handler = async (req, res) => {
  const token = readRefreshCookie(req);
  if (!token) throw new AppError("Not signed in", 401);
  try {
    const { accessToken, refreshToken, refreshExpiresAt, user } = await rotateRefreshToken(token);
    setRefreshCookie(res, refreshToken, refreshExpiresAt);
    sendSuccess(res, { accessToken, user: userResponse(user) });
  } catch (err) {
    // Expired, revoked or suspended: drop the dead cookie along with the 401/403.
    clearRefreshCookie(res);
    throw err;
  }
};

export const logout: Handler = async (req, res) => {
  const token = readRefreshCookie(req);
  if (token) await revokeRefreshToken(token);
  clearRefreshCookie(res);
  sendNoContent(res);
};
