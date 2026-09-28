import { Request, Response, NextFunction, RequestHandler } from "express";
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
  verifyGoogleIdToken,
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

function userResponse(user: AuthenticatedUser) {
  return {
    id: user.userId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    onboardingCompleted: user.onboardingCompleted,
  };
}

// Every flow that ends in "you're now signed in" responds the same way.
async function sendSession(res: Response, user: AuthenticatedUser, status = 200) {
  const tokens = await issueTokenPair(user);
  res.status(status).json({ ...tokens, user: userResponse(user) });
}

const handle =
  (fn: (req: Request, res: Response) => Promise<void>): RequestHandler =>
  (req, res, next: NextFunction) =>
    fn(req, res).catch(next);

export const googleLogin = handle(async (req, res) => {
  const { idToken } = googleLoginSchema.parse(req.body);
  const user = await findOrCreateGoogleUser(await verifyGoogleIdToken(idToken));
  logger.info("User logged in via Google", { userId: user.userId });
  await sendSession(res, user);
});

export const signup = handle(async (req, res) => {
  const input = signupSchema.parse(req.body);
  await signupWithPassword(input);
  logger.info("User signed up, verification pending", { email: input.email });
  res.status(201).json({ requiresVerification: true, email: input.email });
});

export const login = handle(async (req, res) => {
  const user = await loginWithPassword(loginSchema.parse(req.body));
  logger.info("User logged in with password", { userId: user.userId });
  await sendSession(res, user);
});

export const verifyEmailHandler = handle(async (req, res) => {
  const { email, code } = verifyEmailSchema.parse(req.body);
  const user = await verifyEmail(email, code);
  logger.info("Email verified", { userId: user.userId });
  await sendSession(res, user);
});

export const resendVerification = handle(async (req, res) => {
  await resendVerificationCode(emailOnlySchema.parse(req.body).email);
  res.status(200).json({ message: "If that account needs verification, a new code has been sent." });
});

export const forgotPassword = handle(async (req, res) => {
  await requestPasswordReset(emailOnlySchema.parse(req.body).email);
  res.status(200).json({ message: "If an account exists for that email, a reset code has been sent." });
});

export const resetPasswordHandler = handle(async (req, res) => {
  const { email, code, newPassword } = resetPasswordSchema.parse(req.body);
  const user = await resetPassword(email, code, newPassword);
  logger.info("Password reset", { userId: user.userId });
  await sendSession(res, user);
});

export const refresh = handle(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const { accessToken, refreshToken: newRefreshToken, user } = await rotateRefreshToken(refreshToken);
  res.status(200).json({ accessToken, refreshToken: newRefreshToken, user: userResponse(user) });
});

export const logout = handle(async (req, res) => {
  await revokeRefreshToken(refreshSchema.parse(req.body).refreshToken);
  res.status(204).send();
});
