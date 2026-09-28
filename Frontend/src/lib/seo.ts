import type { Metadata } from "next";
import { site } from "./site";

// Every public page sets its own canonical URL and OG tags through this,
// so titles/descriptions/canonicals can't drift out of sync between pages.
export function pageMetadata({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: { type, title, description, url: path, siteName: site.name },
    twitter: { title, description },
  };
}
