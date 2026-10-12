import { rupees } from "./format";
import type { BillingCycle, PlanFeature, PlanId, PlanInfo } from "./types";

// Display helpers for plans. The plans themselves (prices, limits) come from
// the API - see GET /api/plans - so nothing here needs changing with prices.

export const FEATURE_LABELS: Record<PlanFeature, string> = {
  roomFund: "Room funds",
  billSections: "Bill sections",
  findRoom: "Find a room",
};

export const PLAN_NAMES: Record<PlanId, string> = { basic: "Basic", standard: "Standard", premium: "Premium" };

export const limitLabel = (n: number, unlimited: boolean) => (unlimited ? "Unlimited" : String(n));

export function priceLabel(plan: PlanInfo, cycle: BillingCycle) {
  const paise = plan.price[cycle];
  return paise === 0 ? "Free" : rupees(paise).replace(/\.00$/, "");
}

/** The rows every plan card shows, in order: value, or false for a lock. */
export function planRows(plan: PlanInfo): { label: string; value: string | boolean }[] {
  return [
    { label: "Rooms you create", value: limitLabel(plan.maxRooms, plan.unlimited) },
    { label: "People per room", value: limitLabel(plan.maxMembersPerRoom, plan.unlimited) },
    { label: "Split bills & settle up", value: true },
    { label: "Trip groups", value: true },
    { label: FEATURE_LABELS.roomFund, value: plan.features.roomFund },
    { label: FEATURE_LABELS.billSections, value: plan.features.billSections },
    { label: FEATURE_LABELS.findRoom, value: plan.features.findRoom },
    { label: "Room listings", value: plan.maxListings > 0 ? `${plan.maxListings} active` : false },
    { label: "Support", value: plan.support },
  ];
}

/** "+91 98765 43210" -> "9876543210", for prefilling the phone field. */
export const localDigits = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10);
