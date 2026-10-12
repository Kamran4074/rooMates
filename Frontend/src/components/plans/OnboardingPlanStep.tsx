"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { BillingCycle, PlanInfo, UpgradeRequest } from "@/lib/types";
import { PLAN_NAMES } from "@/lib/plans";
import { usePlanStore } from "@/store/planStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { LoadingState } from "@/components/ui/Skeleton";
import { PricingCards } from "./PricingCards";
import { BillingToggle } from "./BillingToggle";
import { UpgradeRequestForm } from "./UpgradeRequestForm";

// Onboarding: everyone starts on Basic. Picking a paid plan sends an upgrade
// request (we call to take the payment) and setup carries on meanwhile.
export function OnboardingPlanStep({ phone, onBack, onDone }: { phone: string; onBack: () => void; onDone: () => void }) {
  const catalog = usePlanStore((s) => s.catalog);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [choosing, setChoosing] = useState<PlanInfo | null>(null);
  const [sent, setSent] = useState<UpgradeRequest | null>(null);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  if (!catalog) return <LoadingState variant="page" />;

  return (
    <>
      {sent && (
        <div className="rounded-3xl border border-success/40 bg-success/10 p-5 mb-6 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          <div className="flex-1">
            <p className="font-medium">Request for {PLAN_NAMES[sent.plan]} sent</p>
            <p className="text-sm text-foreground/60">We&apos;ll call you on {sent.phone}. Until then you&apos;re on Basic - carry on setting up.</p>
          </div>
          <Button size="sm" variant="dark" onClick={onDone}>
            Continue
          </Button>
        </div>
      )}
      <div className="mb-6">
        <BillingToggle value={cycle} onChange={setCycle} />
      </div>
      <PricingCards
        plans={catalog}
        cycle={cycle}
        action={(plan) =>
          plan.id === "basic" ? (
            <Button variant={sent ? "outline" : "dark"} className="w-full" onClick={onDone}>
              {sent ? "Continue" : "Continue with Basic"}
            </Button>
          ) : (
            <Button variant="outline" className="w-full" onClick={() => setChoosing(plan)} disabled={!!sent}>
              {sent?.plan === plan.id ? "Requested" : `Choose ${plan.name}`}
            </Button>
          )
        }
      />
      <div className="mt-5">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-foreground/60 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      </div>
      <Modal open={choosing !== null} onClose={() => setChoosing(null)} title={choosing ? `Get ${choosing.name}` : ""}>
        {choosing && (
          <UpgradeRequestForm
            plan={choosing}
            initialCycle={cycle}
            defaultPhone={phone}
            onSent={(request) => {
              setChoosing(null);
              setSent(request);
            }}
          />
        )}
      </Modal>
    </>
  );
}
