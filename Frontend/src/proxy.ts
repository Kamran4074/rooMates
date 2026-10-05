import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// DEV_LAN_HOST (your Wi-Fi IP) is allowed so people on the same router can use
// the dev server; it's also added to allowedDevOrigins in next.config.ts.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", process.env.DEV_LAN_HOST].filter(Boolean));

// Development only: `next dev` also serves on other network addresses, often a
// virtual adapter (VirtualBox/VMware) nobody can reach. Opened that way, the app
// half-works - Next blocks its dev connection from unknown origins and the API's
// CORS list doesn't include it. Rather than leave a page that silently fails,
// send the browser to localhost.
export function proxy(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.next();

  // The Host header is what the browser actually typed; nextUrl can be
  // normalised to the server's own address.
  const [hostname, port = "3000"] = (request.headers.get("host") ?? "").split(":");
  if (LOCAL_HOSTS.has(hostname)) return NextResponse.next();

  // URL serialisation percent-encodes quotes and angle brackets, so only "&"
  // needs escaping for the HTML attribute.
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, `http://localhost:${port}`).href;
  const href = target.replace(/&/g, "&amp;");

  // An HTML page rather than a 307: the dev server rewrites a Location header
  // pointing at "localhost" back to the request's own host, which would loop.
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${href}">` +
      `<p style="font-family:sans-serif">Opening <a href="${href}">${href}</a>…</p>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

// Page navigations only - not Next's own assets or files in /public.
export const config = {
  matcher: ["/((?!_next/|.*\\..*).*)"],
};
