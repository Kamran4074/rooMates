import { create } from "zustand";
import { apiAuthGet } from "@/lib/api";
import type { JoinRequests } from "@/lib/types";
import { useAuthStore } from "./authStore";

// Join requests: mine (waiting for a room admin) and others' (waiting for me,
// in rooms I run). Shared by the sidebar badge, Notifications, the dashboard
// and the room page, so a decision anywhere updates them all.
interface JoinRequestsState extends JoinRequests {
  load: () => Promise<void>;
  clear: () => void;
}

export const useJoinRequestsStore = create<JoinRequestsState>()((set) => ({
  mine: [],
  toApprove: [],
  load: async () => {
    try {
      set(await apiAuthGet<JoinRequests>("/api/rooms/join-requests"));
    } catch {
      // A badge isn't worth an error message; the next load tries again.
    }
  },
  clear: () => set({ mine: [], toApprove: [] }),
}));

useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) useJoinRequestsStore.getState().clear();
});
