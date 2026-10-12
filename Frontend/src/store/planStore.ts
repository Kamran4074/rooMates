import { create } from "zustand";
import { apiAuthGet } from "@/lib/api";
import type { MyPlan, PlanInfo } from "@/lib/types";
import { getPlanCatalog } from "@/services/plansApi";
import { useAuthStore } from "./authStore";

// My plan (features, limits, latest upgrade request) and the price list.
// Shared by the sidebar locks, the dashboard card, the Plans page and the
// feature gates, so an upgrade shows up everywhere from one fetch.
interface PlanState {
  mine: MyPlan | null;
  catalog: PlanInfo[] | null;
  load: () => Promise<void>;
  loadCatalog: () => Promise<void>;
  clear: () => void;
}

export const usePlanStore = create<PlanState>()((set, get) => ({
  mine: null,
  catalog: null,
  load: async () => {
    try {
      set({ mine: await apiAuthGet<MyPlan>("/api/plans/me") });
    } catch {
      // Keep what we had; the next page change tries again.
    }
  },
  loadCatalog: async () => {
    if (get().catalog) return; // prices don't change within a visit
    try {
      set({ catalog: await getPlanCatalog() });
    } catch {
      // the pricing UI shows its own loading state until it arrives
    }
  },
  clear: () => set({ mine: null }),
}));

useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) usePlanStore.getState().clear();
});
