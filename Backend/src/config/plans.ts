// Plan names and types. The price list itself - prices, limits and what each
// plan unlocks - lives in the plan_catalog table, edited by the super admin
// (Admin > Pricing) and served publicly at GET /api/plans.
//
// The three plans are fixed here because each feature is checked in code.

export const PLAN_IDS = ["basic", "standard", "premium"] as const;
export type Plan = (typeof PLAN_IDS)[number];
export type PaidPlan = Exclude<Plan, "basic">;
export type BillingCycle = "monthly" | "yearly";

export type Feature = "roomFund" | "billSections" | "findRoom";

export const FEATURE_NAMES: Record<Feature, string> = {
  roomFund: "Room funds",
  billSections: "Bill sections",
  findRoom: "Find a room",
};

export const BILLING_MONTHS: Record<BillingCycle, number> = { monthly: 1, yearly: 12 };
