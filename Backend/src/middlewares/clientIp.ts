import crypto from "crypto";
import { isIP } from "net";
import { Request } from "express";
import { env } from "../config/env";

// The caller's real IP, for per-IP rate limits.
//
// Auth requests reach us through the frontend's server (see authCookie.ts), so
// req.ip there is the frontend's server, shared by every user - one shared
// login budget for the whole world. That proxy passes the browser's IP in
// x-roomates-client-ip, and we believe it only when the request also carries
// PROXY_SECRET. Anyone else sending that header is ignored, so it can't be
// used to dodge rate limits.
const sameSecret = (given: string, secret: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

export function clientIp(req: Request): string {
  const secret = env.PROXY_SECRET;
  const claimed = req.get("x-roomates-client-ip");
  if (secret && claimed && isIP(claimed) && sameSecret(req.get("x-roomates-proxy-secret") ?? "", secret)) {
    return claimed;
  }
  return req.ip ?? "";
}
