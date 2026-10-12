import { apiAuthPost, apiGet } from "@/lib/api";
import type { BillingCycle, PaidPlanId, PlanInfo, UpgradeRequest } from "@/lib/types";

export const getPlanCatalog = () => apiGet<PlanInfo[]>("/api/plans");

export const requestUpgrade = (input: { plan: PaidPlanId; billingCycle: BillingCycle; phone: string; note?: string }) =>
  apiAuthPost<UpgradeRequest>("/api/plans/upgrade-requests", input);

export const cancelUpgradeRequest = (id: string) => apiAuthPost<UpgradeRequest>(`/api/plans/upgrade-requests/${id}/cancel`, {});
