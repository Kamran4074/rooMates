import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryOptions";

// Server side of the Next.js app (rendering, metadata, sitemap). The API's
// own errors are reported by the backend, not here.
export function register() {
  Sentry.init(sentryOptions);
}

// Errors thrown while the Next.js server renders a page.
export const onRequestError = Sentry.captureRequestError;
