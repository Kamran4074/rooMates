"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { FEATURE_LABELS } from "@/lib/plans";
import type { PlanFeature, PlanInfo } from "@/lib/types";
import { updatePricing } from "@/services/adminApi";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export interface PricingRow extends PlanInfo {
  updatedAt: string;
  updatedByName: string | null;
  accounts: number;
}

/** The form's values: prices in rupees, as typed. */
export interface PlanDraft {
  name: string;
  tagline: string;
  priceMonthly: string;
  priceYearly: string;
  maxRooms: string;
  maxMembersPerRoom: string;
  maxListings: string;
  unlimited: boolean;
  features: Record<PlanFeature, boolean>;
  support: string;
}

export const toDraft = (p: PlanInfo): PlanDraft => ({
  name: p.name,
  tagline: p.tagline,
  priceMonthly: String(p.price.monthly / 100),
  priceYearly: String(p.price.yearly / 100),
  maxRooms: String(p.maxRooms),
  maxMembersPerRoom: String(p.maxMembersPerRoom),
  maxListings: String(p.maxListings),
  unlimited: p.unlimited,
  features: { ...p.features },
  support: p.support,
});

/** The draft as a plan, for the live preview. */
export const draftToPlan = (id: PlanInfo["id"], d: PlanDraft): PlanInfo => ({
  id,
  name: d.name,
  tagline: d.tagline,
  price: { monthly: Math.round(Number(d.priceMonthly) * 100) || 0, yearly: Math.round(Number(d.priceYearly) * 100) || 0 },
  maxRooms: Number(d.maxRooms) || 0,
  maxMembersPerRoom: Number(d.maxMembersPerRoom) || 0,
  maxListings: Number(d.maxListings) || 0,
  unlimited: d.unlimited,
  features: d.features,
  support: d.support,
});

// One plan in the admin's Pricing page.
export function PlanEditor({
  plan,
  draft,
  onChange,
  onSaved,
}: {
  plan: PricingRow;
  draft: PlanDraft;
  onChange: (draft: PlanDraft) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const isBasic = plan.id === "basic";
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(plan));
  const set = (patch: Partial<PlanDraft>) => {
    setSaved(null);
    onChange({ ...draft, ...patch });
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await updatePricing(plan.id, {
        ...draft,
        priceMonthly: Number(draft.priceMonthly),
        priceYearly: Number(draft.priceYearly),
        maxRooms: Number(draft.maxRooms),
        maxMembersPerRoom: Number(draft.maxMembersPerRoom),
        maxListings: Number(draft.maxListings),
      });
      setSaved(`Saved. Limits now apply to the ${plan.accounts} account${plan.accounts === 1 ? "" : "s"} on ${draft.name}.`);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the plan"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="form" onSubmit={save} className="rounded-3xl p-6 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold capitalize">{plan.id}</h2>
        <span className="text-xs text-foreground/50">
          {plan.accounts} account{plan.accounts === 1 ? "" : "s"}
        </span>
      </div>

      <TextField label="Name" required maxLength={30} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
      <TextField label="Tagline" maxLength={120} value={draft.tagline} onChange={(e) => set({ tagline: e.target.value })} />

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label="₹ / month"
          type="number"
          min={0}
          step="1"
          disabled={isBasic}
          value={draft.priceMonthly}
          onChange={(e) => set({ priceMonthly: e.target.value })}
        />
        <TextField label="₹ / year" type="number" min={0} step="1" disabled={isBasic} value={draft.priceYearly} onChange={(e) => set({ priceYearly: e.target.value })} />
      </div>
      {isBasic ? (
        <p className="text-xs text-foreground/50 -mt-2">Basic is the free plan everyone falls back to.</p>
      ) : (
        <button
          type="button"
          onClick={() => set({ priceYearly: String(Number(draft.priceMonthly) * 10) })}
          className="text-xs text-primary font-medium self-start -mt-2"
        >
          Set yearly to 10 × monthly (2 months free)
        </button>
      )}

      {/* Rooms each account can create, people per room, active room listings. */}
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Rooms" type="number" min={1} max={100} value={draft.maxRooms} onChange={(e) => set({ maxRooms: e.target.value })} />
        <TextField label="People" type="number" min={2} max={100} value={draft.maxMembersPerRoom} onChange={(e) => set({ maxMembersPerRoom: e.target.value })} />
        <TextField label="Listings" type="number" min={0} max={100} value={draft.maxListings} onChange={(e) => set({ maxListings: e.target.value })} />
      </div>

      <ul className="flex flex-col gap-2.5">
        <li className="flex items-center justify-between gap-3 text-sm">
          <span>Show limits as &ldquo;Unlimited&rdquo;</span>
          <Switch checked={draft.unlimited} onChange={(v) => set({ unlimited: v })} label={`${plan.id}: show as unlimited`} onText="Yes" offText="No" />
        </li>
        {(Object.keys(FEATURE_LABELS) as PlanFeature[]).map((f) => (
          <li key={f} className="flex items-center justify-between gap-3 text-sm">
            <span>{FEATURE_LABELS[f]}</span>
            <Switch
              checked={draft.features[f]}
              onChange={(v) => set({ features: { ...draft.features, [f]: v } })}
              label={`${plan.id}: ${FEATURE_LABELS[f]}`}
              onText="Included"
              offText="Locked"
            />
          </li>
        ))}
      </ul>

      <TextField label="Support" maxLength={40} value={draft.support} onChange={(e) => set({ support: e.target.value })} />

      <FormMessage error={error} success={saved} />
      <div className="flex items-center justify-between gap-3 mt-auto">
        <span className="text-xs text-foreground/45">
          Changed {formatDate(plan.updatedAt, "short")}
          {plan.updatedByName && ` by ${plan.updatedByName}`}
        </span>
        <Button type="submit" variant="dark" size="sm" loading={saving} disabled={!dirty}>
          Save {draft.name || plan.id}
        </Button>
      </div>
    </Card>
  );
}
