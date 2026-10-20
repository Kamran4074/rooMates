import { Request } from "express";
import { ipKeyGenerator, rateLimit, Options } from "express-rate-limit";
import { slowDown } from "express-slow-down";
import { verifyAccessToken } from "./authenticate";

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

// Signed in: count per account. Flatmates on one WiFi share a public IP, so
// per-IP alone would make them use up each other's budget. Signed out (or a
// bad token): per IP, with IPv6 grouped by /56 so one host can't rotate
// through its own addresses. Verifying the token is just an HMAC check.
export function userOrIp(req: Request) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      return `user:${verifyAccessToken(header.slice(7)).sub}`;
    } catch {
      // fall through to the IP
    }
  }
  return ipKeyGenerator(req.ip ?? "");
}

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

// Baseline for every API route - stops scripted hammering of anything.
export const apiLimiter = limiter(15, 600, "Too many requests. Please slow down and try again shortly.", { keyGenerator: userOrIp });

// Changes (add/delete/approve...) on top of that: generous for a person
// clicking, tight for a script filling a room with junk expenses.
export const writeLimiter = limiter(1, 60, "You're doing that too fast. Wait a minute and try again.", {
  keyGenerator: userOrIp,
  skip: (req) => READS.has(req.method),
});

// Each join request pings a room admin, so a user gets a few per hour.
export const joinLimiter = limiter(60, 10, "Too many join requests. Try again in an hour.", { keyGenerator: userOrIp });

// Each signature lets the browser upload one photo to Cloudinary (real storage cost).
export const uploadLimiter = limiter(60, 40, "Too many photo uploads. Try again in an hour.", { keyGenerator: userOrIp });

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

// Deleting needs the password, so cap guesses per account like login does.
export const deleteAccountLimiter = limiter(15, 5, "Too many attempts. Try again in 15 minutes.", {
  keyGenerator: userOrIp,
  skipSuccessfulRequests: true,
});

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
