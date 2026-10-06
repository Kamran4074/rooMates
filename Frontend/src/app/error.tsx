"use client";

import { useEffect } from "react";
import Link from "next/link";
import { StatusPage } from "@/components/StatusPage";
import { Button } from "@/components/ui/Button";

// Catches a crash while rendering any page, instead of a blank screen.
// API errors are handled on each page; this is for bugs.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Visible in the browser console while developing; a monitoring tool
    // (e.g. Sentry) would pick it up here in production.
    console.error(error);
  }, [error]);

  return (
    <StatusPage code="Error" title="Something went wrong" message="This page hit a problem. Trying again usually fixes it.">
      <Button onClick={reset}>Try again</Button>
      <Link href="/dashboard" className="h-11 px-5 rounded-full border border-card-border font-medium inline-flex items-center hover:bg-foreground/5">
        Go to dashboard
      </Link>
    </StatusPage>
  );
}
