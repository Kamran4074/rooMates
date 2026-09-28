import { Router } from "express";
import {
  googleLogin,
  signup,
  login,
  verifyEmailHandler,
  resendVerification,
  forgotPassword,
  resetPasswordHandler,
  refresh,
  logout,
} from "./auth.controller";
import {
  authLimiter,
  loginAccountLimiter,
  loginThrottle,
  otpVerifyLimiter,
  emailSendLimiter,
} from "../../middlewares/rateLimit";

const router = Router();

router.post("/google", authLimiter, googleLogin);
router.post("/signup", emailSendLimiter, signup);
router.post("/login", loginThrottle, authLimiter, loginAccountLimiter, login);
router.post("/verify-email", otpVerifyLimiter, verifyEmailHandler);
router.post("/resend-verification", emailSendLimiter, resendVerification);
router.post("/forgot-password", emailSendLimiter, forgotPassword);
router.post("/reset-password", otpVerifyLimiter, resetPasswordHandler);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
