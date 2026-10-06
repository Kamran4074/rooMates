import type { Metadata } from "next";
import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <StatusPage code="404" title="This page doesn't exist" message="The link may be broken, or the page may have moved.">
      <Link href="/dashboard" className="h-11 px-5 rounded-full bg-primary text-white font-medium inline-flex items-center hover:bg-primary-dark">
        Go to dashboard
      </Link>
      <Link href="/" className="h-11 px-5 rounded-full border border-card-border font-medium inline-flex items-center hover:bg-foreground/5">
        Home page
      </Link>
    </StatusPage>
  );
}
