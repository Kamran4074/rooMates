"use client";

import Link from "next/link";
import { Lock, Sparkles } from "lucide-react";
import { FEATURE_LABELS } from "@/lib/plans";
import type { PlanFeature } from "@/lib/types";
import { usePlanStore } from "@/store/planStore";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/Skeleton";

// "This is on Standard and up" screen, with the way to upgrade.
export function LockedFeature({ feature, children }: { feature: PlanFeature; children?: React.ReactNode }) {
  return (
    <EmptyState
      icon={<Lock className="h-6 w-6" />}
      title={`${FEATURE_LABELS[feature]} is on the Standard plan`}
      action={
        <Link
          href="/plans"
          className="h-10 px-5 rounded-full bg-foreground text-background font-medium inline-flex items-center gap-1.5 hover:bg-foreground/85"
        >
          <Sparkles className="h-4 w-4" /> See plans
        </Link>
      }
    >
      {children ?? "Upgrade to Standard or Premium to use it. Splitting bills stays free on Basic."}
    </EmptyState>
  );
}

// Shows a page only if my plan includes the feature. The API checks too -
// this is so a Basic user sees why, not an error.
export function PlanGate({ feature, children }: { feature: PlanFeature; children: React.ReactNode }) {
  const mine = usePlanStore((s) => s.mine);
  if (!mine) return <LoadingState variant="page" />;
  if (!mine.features[feature]) {
    return (
      <LockedFeature feature={feature}>
        {feature === "findRoom" ? "Browse rooms near you, message owners and list your own room on Standard and Premium." : undefined}
      </LockedFeature>
    );
  }
  return <>{children}</>;
}
