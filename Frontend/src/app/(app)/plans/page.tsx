"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { limitLabel, localDigits, PLAN_NAMES } from "@/lib/plans";
import { useApiQuery } from "@/lib/useApiQuery";
import type { BillingCycle, Me, PlanInfo } from "@/lib/types";
import { usePlanStore } from "@/store/planStore";
import { useToastStore } from "@/store/toastStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { LoadingState } from "@/components/ui/Skeleton";
import { PricingCards } from "@/components/plans/PricingCards";
import { BillingToggle } from "@/components/plans/BillingToggle";
import { UpgradeRequestForm } from "@/components/plans/UpgradeRequestForm";
import { UpgradeRequestStatus } from "@/components/plans/UpgradeRequestStatus";

function Usage({ label, used, max, unlimited }: { label: string; used: number; max: number; unlimited: boolean }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="text-foreground/55">
          <strong className="text-foreground">{used}</strong> of {limitLabel(max, unlimited)}
        </span>
      </div>
      {!unlimited && <ProgressBar value={used} max={Math.max(max, 1)} />}
    </div>
  );
}

export default function PlansPage() {
  const mine = usePlanStore((s) => s.mine);
  const catalog = usePlanStore((s) => s.catalog);
  const load = usePlanStore((s) => s.load);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const { data: me } = useApiQuery<Me>("/api/users/me");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [choosing, setChoosing] = useState<PlanInfo | null>(null);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  if (!mine || !catalog) return <LoadingState variant="page" />;
  const current = catalog.find((p) => p.id === mine.plan)!;
  const waiting = mine.latestRequest?.status === "pending";

  return (
    <>
      <PageHeader title="Plans" subtitle="What your plan includes, and how to upgrade." />

      <UpgradeRequestStatus request={mine.latestRequest} onChanged={load} />

      <Card className="rounded-3xl p-6 mb-8 grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
        <div>
          <p className="text-sm text-foreground/55">Your plan</p>
          <p className="text-2xl font-semibold">{PLAN_NAMES[mine.plan]}</p>
          <p className="text-sm text-foreground/60 mt-1">
            {mine.expiresAt
              ? `Active until ${formatDate(mine.expiresAt)}, then back to Basic unless renewed.`
              : mine.plan === "basic"
                ? "Free forever."
                : "No end date."}
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <Usage label="Rooms you created" used={mine.usage.rooms} max={mine.limits.maxRooms} unlimited={current.unlimited} />
          <Usage label="Active room listings" used={mine.usage.listings} max={mine.limits.maxListings} unlimited={false} />
          <p className="text-sm text-foreground/60">
            Up to <strong className="text-foreground">{limitLabel(mine.limits.maxMembersPerRoom, current.unlimited)}</strong> people in each room you create.
          </p>
        </div>
      </Card>

      <div className="mb-6">
        <BillingToggle value={cycle} onChange={setCycle} />
      </div>
      <PricingCards
        plans={catalog}
        cycle={cycle}
        current={mine.plan}
        action={(plan) => {
          if (plan.id === "basic") {
            return (
              <Button variant="outline" className="w-full" disabled>
                {mine.plan === "basic" ? "Current plan" : "Included when a plan ends"}
              </Button>
            );
          }
          const isCurrent = plan.id === mine.plan;
          return (
            <Button variant={isCurrent ? "outline" : "dark"} className="w-full" disabled={waiting} onClick={() => setChoosing(plan)}>
              {waiting ? "Request waiting" : isCurrent ? `Renew ${plan.name}` : `Get ${plan.name}`}
            </Button>
          );
        }}
      />

      <Modal open={choosing !== null} onClose={() => setChoosing(null)} title={choosing ? `Get ${choosing.name}` : ""}>
        {choosing && (
          <UpgradeRequestForm
            plan={choosing}
            initialCycle={cycle}
            defaultPhone={localDigits(me?.phone)}
            onSent={() => {
              setChoosing(null);
              load();
              useToastStore.getState().show("Request sent - we'll call you to complete the upgrade");
            }}
          />
        )}
      </Modal>
    </>
  );
}
