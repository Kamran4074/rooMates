import { Request, Response } from "express";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import {
  googleLoginSchema,
  signupSchema,
  loginSchema,
  refreshSchema,
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

// Every flow that ends in "you're now signed in" responds the same way.
async function sendSession(res: Response, user: AuthenticatedUser) {
  const { role, ...tokens } = await issueTokenPair(user);
  sendSuccess(res, { ...tokens, user: userResponse({ ...user, role }) });
}

export const googleLogin: Handler = async (req, res) => {
  const { accessToken } = googleLoginSchema.parse(req.body);
  const user = await findOrCreateGoogleUser(await verifyGoogleAccessToken(accessToken));
  logger.info("User logged in via Google", { userId: user.userId });
  await sendSession(res, user);
};

export const signup: Handler = async (req, res) => {
  const input = signupSchema.parse(req.body);
  await signupWithPassword(input);
  logger.info("User signed up, verification pending", { email: input.email });
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
  const { refreshToken } = refreshSchema.parse(req.body);
  const { accessToken, refreshToken: newRefreshToken, user } = await rotateRefreshToken(refreshToken);
  sendSuccess(res, { accessToken, refreshToken: newRefreshToken, user: userResponse(user) });
};

export const logout: Handler = async (req, res) => {
  await revokeRefreshToken(refreshSchema.parse(req.body).refreshToken);
  sendNoContent(res);
};
