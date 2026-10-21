import * as Sentry from "@sentry/node";
import { env } from "./env";

// Error tracking for the API. Only real bugs reach Sentry: errorHandler
// reports unhandled errors (the 500s), never expected ones like a wrong
// password or "Room not found". Sentry also catches crashes outside a request
// (an uncaught exception or rejected promise in a background job).
//
// With no SENTRY_DSN (local dev, tests) it stays off and sends nothing.
// Imported first in index.ts so it's ready before anything else runs.
Sentry.init({
  dsn: env.SENTRY_DSN,
  enabled: Boolean(env.SENTRY_DSN),
  environment: env.NODE_ENV,
  // Render sets this to the deployed commit, so each error shows which deploy
  // introduced it.
  release: process.env.RENDER_GIT_COMMIT,
  // Errors only - performance tracing would use up the free tier fast.
  tracesSampleRate: 0,
  // Sentry collects all of this by default. Errors from this API would carry
  // passwords and tokens (request bodies, local variables like `password`,
  // SQL parameters), so every category is off: only the stack trace and the
  // route + user id that errorHandler attaches are sent.
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
});
