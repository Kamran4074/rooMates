import { create } from "zustand";
import { apiAuthGet, errorMessage } from "@/lib/api";
import type { FundApproval } from "@/lib/types";
import { useAuthStore } from "./authStore";

// Fund payments others recorded for me, waiting for my approval. Shared by
// the sidebar badge, the dashboard and the Expenses page, so approving one
// anywhere updates all three from one fetch.
interface ApprovalsState {
  items: FundApproval[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
}

export const useApprovalsStore = create<ApprovalsState>()((set) => ({
  items: [],
  loaded: false,
  error: null,
  load: async () => {
    try {
      set({ items: await apiAuthGet<FundApproval[]>("/api/fund-approvals"), loaded: true, error: null });
    } catch (err) {
      set({ loaded: true, error: errorMessage(err, "Couldn't load approvals") });
    }
  },
  clear: () => set({ items: [], loaded: false, error: null }),
}));

// Same as the rooms store: never show the previous account's approvals.
useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) useApprovalsStore.getState().clear();
});
