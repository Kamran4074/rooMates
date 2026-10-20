"use client";

import { Analytics as VercelAnalytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Page views via Vercel Web Analytics: no cookies, no cross-site tracking.
// Query strings are dropped before anything is sent - some pages carry the
// user's email in the URL (/verify-email?email=...), and that must never
// reach a third party. Room and listing ids in paths are harmless.
function stripQuery(event: BeforeSendEvent): BeforeSendEvent {
  const url = new URL(event.url);
  url.search = "";
  return { ...event, url: url.toString() };
}

export function Analytics() {
  return <VercelAnalytics beforeSend={stripQuery} />;
}
