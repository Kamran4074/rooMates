import type { ErrorEvent, init } from "@sentry/nextjs";

// Shared by the browser and server Sentry setups (instrumentation*.ts).
// With no DSN set (local dev, or before the Sentry project exists) Sentry
// stays off and nothing is sent anywhere.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Some pages carry the user's email in the URL (/verify-email?email=...);
// strip query strings so no personal data ends up in Sentry.
function withoutQuery(url: string | undefined) {
  return url?.split("?")[0];
}

function scrub(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    event.request.url = withoutQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.headers;
    delete event.request.cookies;
  }
  return event;
}

export const sentryOptions = {
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.NODE_ENV,
  // Errors only. Performance tracing would use up the free tier's quota fast.
  tracesSampleRate: 0,
  // Sentry collects all of this by default - request bodies (passwords on the
  // sign-in form), local variables, headers (the access token), cookies.
  // Everything is off: only the error and its stack trace are sent.
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: false,
    databaseQueryData: false,
    stackFrameVariables: false,
    queues: false,
    genAI: { inputs: false, outputs: false },
  },
  beforeSend: scrub,
  // `satisfies` so a misspelt or removed option is a type error, not silently ignored.
} satisfies Parameters<typeof init>[0];
