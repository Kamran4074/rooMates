import { Check, Lock } from "lucide-react";
import { planRows, priceLabel } from "@/lib/plans";
import type { BillingCycle, PlanId, PlanInfo } from "@/lib/types";
import { Card } from "@/components/ui/Card";

// The three plan cards, used by the public pricing page, onboarding and the
// in-app Plans page. What each card's button does is up to the page.
export function PricingCards({
  plans,
  cycle,
  current,
  popular = "standard",
  action,
}: {
  plans: PlanInfo[];
  cycle: BillingCycle;
  /** Ringed and labelled "Your plan". */
  current?: PlanId;
  popular?: PlanId;
  action: (plan: PlanInfo) => React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
      {plans.map((plan) => {
        const isCurrent = plan.id === current;
        const isPopular = plan.id === popular && !isCurrent;
        return (
          <Card
            key={plan.id}
            className={`relative rounded-3xl p-6 flex flex-col ${isCurrent ? "border-primary ring-1 ring-primary" : isPopular ? "border-accent/60" : ""}`}
          >
            {(isCurrent || isPopular) && (
              <span
                className={`absolute -top-3 right-6 rounded-full px-3 py-0.5 text-xs font-semibold ${isCurrent ? "bg-primary text-white" : "bg-accent text-white"}`}
              >
                {isCurrent ? "Your plan" : "Most popular"}
              </span>
            )}
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <p className="text-sm text-foreground/60 mt-1 min-h-10">{plan.tagline}</p>
            <p className="mt-5 mb-5 flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tracking-tight">{priceLabel(plan, cycle)}</span>
              {plan.price[cycle] > 0 && <span className="text-sm text-foreground/55">/ {cycle === "monthly" ? "month" : "year"}</span>}
              {plan.price[cycle] === 0 && <span className="text-sm text-foreground/55">forever</span>}
            </p>
            <div className="mb-6">{action(plan)}</div>
            <ul className="flex flex-col gap-2.5 text-sm border-t border-card-border pt-5">
              {planRows(plan).map((row) => (
                <li key={row.label} className={`flex items-start gap-2.5 ${row.value === false ? "text-foreground/40" : ""}`}>
                  {row.value === false ? (
                    <Lock className="h-4 w-4 mt-0.5 shrink-0" aria-label="Not included" />
                  ) : (
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-success" aria-hidden="true" />
                  )}
                  <span className="flex-1">{row.label}</span>
                  {typeof row.value === "string" && <span className="font-medium text-right">{row.value}</span>}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
