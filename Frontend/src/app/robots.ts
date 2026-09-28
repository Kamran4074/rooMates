import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Logged-in app screens and one-time auth steps have nothing useful for
// search engines and shouldn't show up in results.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/rooms/", "/onboarding", "/verify-email", "/reset-password", "/forgot-password"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
