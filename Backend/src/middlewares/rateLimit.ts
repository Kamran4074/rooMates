import { rateLimit, Options } from "express-rate-limit";
import { slowDown } from "express-slow-down";

// In-memory counters: fine for a single server, but they reset on restart and
// aren't shared between instances. Once Redis is added, switch these to a
// Redis store so limits hold across restarts and horizontal scaling.

const MINUTE = 60 * 1000;

function limiter(windowMinutes: number, limit: number, message: string, extra: Partial<Options> = {}) {
  return rateLimit({
    windowMs: windowMinutes * MINUTE,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
    ...extra,
  });
}

// Baseline for every API route, per IP - stops scripted hammering of anything.
export const apiLimiter = limiter(15, 300, "Too many requests. Please slow down and try again shortly.");

// Per IP: caps how many sign-in attempts one network can make overall.
export const authLimiter = limiter(15, 20, "Too many sign-in attempts from this network. Try again in 15 minutes.");

// Per ACCOUNT, counting only failures: an attacker spreading password guesses
// across many IPs still gets just 5 tries per account per window, while a
// user who logs in successfully never burns their budget.
export const loginAccountLimiter = limiter(15, 5, "Too many failed attempts for this account. Try again in 15 minutes.", {
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `login:${String(req.body?.email ?? "").trim().toLowerCase()}`,
});

// Per IP across OTP checks. Each code already locks after 5 wrong guesses;
// this stops someone cycling through fresh codes to keep guessing.
export const otpVerifyLimiter = limiter(15, 10, "Too many code attempts. Try again in 15 minutes.");

// Anything that sends an email costs real email quota and can be used to spam
// someone's inbox, so these share one tight per-IP budget.
export const emailSendLimiter = limiter(60, 8, "Too many emails requested. Please try again in an hour.");

export const contactLimiter = limiter(60, 3, "You've sent a few messages already. Please try again later.");

// Throttling, not blocking: after 3 login attempts in the window each extra
// attempt is delayed a little more (0.5s, 1s, 1.5s... capped at 5s). A human
// barely notices; a password-guessing script slows to a crawl.
export const loginThrottle = slowDown({
  windowMs: 15 * MINUTE,
  delayAfter: 3,
  delayMs: (used) => (used - 3) * 500,
  maxDelayMs: 5000,
});
