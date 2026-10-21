import { CookieOptions, Request, Response } from "express";
import { env } from "./env";

// The refresh token lives in an httpOnly cookie, so JavaScript on the page -
// including an XSS payload or a compromised npm package - can't read it.
// (The 15-minute access token stays readable; stolen, it's useful briefly.)
//
// The browser only ever talks to /api/auth through the frontend's own domain
// (Next.js forwards it here), so this is a first-party cookie there. A cookie
// set straight from this API's domain would be third-party, which Safari and
// incognito windows block.
//
//  - sameSite strict: never sent on a request started by another site (CSRF)
//  - path /api/auth: not sent with any other request
//  - secure in production: HTTPS only
export const REFRESH_COOKIE = "rm_refresh";

const options: CookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
};

// Expires with the session itself (sign-in + SESSION_MAX_AGE_HOURS).
export function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, { ...options, expires: expiresAt });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, options);
}

// Express has no cookie parser built in, and this is the only cookie the API
// reads - not worth a dependency.
export function readRefreshCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === REFRESH_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim()) || undefined;
    }
  }
  return undefined;
}
