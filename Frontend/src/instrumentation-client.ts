import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "@/lib/sentryOptions";

// Runs in the browser before the app becomes interactive: reports crashes and
// unhandled promise rejections to Sentry (when NEXT_PUBLIC_SENTRY_DSN is set).
Sentry.init({
  ...sentryOptions,
  beforeBreadcrumb(crumb) {
    // Navigation and fetch breadcrumbs record URLs - drop their query strings too.
    for (const key of ["url", "from", "to"] as const) {
      const value = crumb.data?.[key];
      if (typeof value === "string") crumb.data![key] = value.split("?")[0];
    }
    return crumb;
  },
});
