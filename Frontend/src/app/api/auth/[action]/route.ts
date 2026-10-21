// Same-origin front door for /api/auth/*: forwards each call to the API and
// passes its response (including Set-Cookie) back unchanged.
//
// Why: the refresh token is an httpOnly cookie. Set straight from the API's
// own domain (Render) it would be a third-party cookie on this site, which
// Safari, every iPhone browser and incognito windows block - those users would
// be signed out every 15 minutes. Coming through here, it's a first-party
// cookie of this domain.
//
// Only auth calls come through here; everything else still goes straight to
// the API with the access token.

export const maxDuration = 60; // the free Render instance can take ~50s to wake up

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// Exactly the API's auth routes - this can't be used to reach anything else.
const ACTIONS = new Set([
  "login",
  "google",
  "signup",
  "verify-email",
  "resend-verification",
  "forgot-password",
  "reset-password",
  "refresh",
  "logout",
]);

// Response headers worth passing on: the cookie, and rate-limit info.
const PASS_BACK = ["content-type", "retry-after", "ratelimit", "ratelimit-policy"];

function json(status: number, message: string) {
  return Response.json({ success: false, message }, { status });
}

export async function POST(request: Request, ctx: RouteContext<"/api/auth/[action]">) {
  const { action } = await ctx.params;
  if (!ACTIONS.has(action)) return json(404, "Not found");

  const headers = new Headers({ "content-type": request.headers.get("content-type") ?? "application/json" });
  const cookie = request.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const userAgent = request.headers.get("user-agent");
  if (userAgent) headers.set("user-agent", userAgent);

  // The API rate-limits sign-in per IP. Without this every user would share
  // this server's IP (and its budget). The API believes the forwarded IP only
  // with the shared secret. On Vercel, x-real-ip is the visitor's address and
  // can't be set by the browser.
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const secret = process.env.PROXY_SECRET;
  if (ip && secret) {
    headers.set("x-roomates-client-ip", ip);
    headers.set("x-roomates-proxy-secret", secret);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/auth/${action}`, {
      method: "POST",
      headers,
      body: await request.text(),
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    // Not a 401: the app treats this as temporary and keeps the session.
    return json(502, "Couldn't reach the server. Please try again.");
  }

  const out = new Headers();
  for (const name of PASS_BACK) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  for (const setCookie of upstream.headers.getSetCookie()) out.append("set-cookie", setCookie);

  return new Response(upstream.status === 204 ? null : await upstream.text(), { status: upstream.status, headers: out });
}
