"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { BillingCycle } from "@/lib/types";
import { usePlanStore } from "@/store/planStore";
import { Skeleton } from "@/components/ui/Skeleton";
import { PricingCards } from "./PricingCards";
import { BillingToggle } from "./BillingToggle";

// The pricing section for visitors. Prices come from the API, so this page
// never disagrees with what the app charges.
export function PublicPricing() {
  const catalog = usePlanStore((s) => s.catalog);
  const loadCatalog = usePlanStore((s) => s.loadCatalog);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  return (
    <>
      <div className="flex justify-center mb-10">
        <BillingToggle value={cycle} onChange={setCycle} />
      </div>
      {catalog ? (
        <PricingCards
          plans={catalog}
          cycle={cycle}
          action={(plan) => (
            <Link
              href="/signup"
              className={`h-11 w-full rounded-full font-medium inline-flex items-center justify-center ${
                plan.id === "standard" ? "bg-primary text-white hover:bg-primary-dark" : "border border-card-border hover:bg-foreground/5"
              }`}
            >
              {plan.id === "basic" ? "Start free" : `Get ${plan.name}`}
            </Link>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[560px] rounded-3xl" />
          ))}
        </div>
      )}
    </>
  );
}
