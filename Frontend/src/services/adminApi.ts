import type { PlanId } from "@/lib/types";
import { apiAuthPost, apiAuthPatch } from "@/lib/api";

// Super-admin actions. The server re-checks the admin role on every call;
// hiding these screens from other users is only for a tidy UI.

export const approveListing = (id: string) => apiAuthPost(`/api/admin/listings/${id}/approve`, {});
export const rejectListing = (id: string, reason: string) => apiAuthPost(`/api/admin/listings/${id}/reject`, { reason });
export const removeListing = (id: string, reason: string) => apiAuthPost(`/api/admin/listings/${id}/remove`, { reason });

export const suspendUser = (id: string, reason?: string) => apiAuthPost(`/api/admin/users/${id}/suspend`, { reason });
export const unsuspendUser = (id: string) => apiAuthPost(`/api/admin/users/${id}/unsuspend`, {});
export const setUserPlan = (id: string, plan: PlanId) => apiAuthPost(`/api/admin/users/${id}/plan`, { plan });
export const updatePricing = (plan: PlanId, input: object) => apiAuthPatch(`/api/admin/pricing/${plan}`, input);
export const approveUpgrade = (id: string, note?: string) => apiAuthPost(`/api/admin/upgrade-requests/${id}/approve`, { note });
export const rejectUpgrade = (id: string, note?: string) => apiAuthPost(`/api/admin/upgrade-requests/${id}/reject`, { note });
// Anonymises the account; the API refuses while they have money to settle.
export const deleteUser = (id: string, reason: string) => apiAuthPost(`/api/admin/users/${id}/delete`, { reason });

export const resolveReport = (id: string, action: "dismiss" | "resolve" | "remove_listing", note?: string) =>
  apiAuthPost(`/api/admin/reports/${id}/resolve`, { action, note });
