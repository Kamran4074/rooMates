"use client";

import { useState } from "react";
import { useApiQuery } from "@/lib/useApiQuery";
import type { BillingCycle, PlanId } from "@/lib/types";
import { usePlanStore } from "@/store/planStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { LoadingState } from "@/components/ui/Skeleton";
import { PageError } from "@/components/ui/PageError";
import { Button } from "@/components/ui/Button";
import { PlanDraft, PlanEditor, PricingRow, draftToPlan, toDraft } from "@/components/admin/PlanEditor";
import { PricingCards } from "@/components/plans/PricingCards";
import { BillingToggle } from "@/components/plans/BillingToggle";

// The price list, edited here and shown everywhere (pricing page, onboarding,
// Plans page). The preview below shows the cards as they'll look, unsaved
// edits included.
export default function AdminPricingPage() {
  const { data, error, notFound, reload } = useApiQuery<PricingRow[]>("/api/admin/pricing");
  const [drafts, setDrafts] = useState<Partial<Record<PlanId, PlanDraft>>>({});
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  if (error) return <PageError error={error} notFound={notFound} onRetry={reload} what="page" backHref="/admin" backLabel="Back to overview" />;
  if (!data) return <LoadingState variant="page" />;

  const draftOf = (p: PricingRow) => drafts[p.id] ?? toDraft(p);

  return (
    <>
      <PageHeader
        title="Pricing"
        subtitle="Prices, limits and what each plan unlocks. Changes go live at once; requests already sent keep their quoted price."
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mb-12">
        {data.map((p) => (
          <PlanEditor
            key={p.id}
            plan={p}
            draft={draftOf(p)}
            onChange={(d) => setDrafts((all) => ({ ...all, [p.id]: d }))}
            onSaved={() => {
              setDrafts((all) => ({ ...all, [p.id]: undefined }));
              usePlanStore.setState({ catalog: null }); // the app re-reads the new prices
              reload();
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 className="text-lg font-semibold">Preview</h2>
        <div className="flex items-center gap-3">
          {Object.values(drafts).some(Boolean) && (
            <Button size="sm" variant="ghost" onClick={() => setDrafts({})}>
              Discard changes
            </Button>
          )}
          <BillingToggle value={cycle} onChange={setCycle} />
        </div>
      </div>
      <PricingCards
        plans={data.map((p) => draftToPlan(p.id, draftOf(p)))}
        cycle={cycle}
        action={(plan) => (
          <div className="h-11 w-full rounded-full border border-dashed border-card-border text-sm text-foreground/50 flex items-center justify-center">
            {plan.id === "basic" ? "Start free" : `Get ${plan.name}`}
          </div>
        )}
      />
    </>
  );
}
