import { create } from "zustand";
import { apiAuthGet, apiAuthPost } from "@/lib/api";
import { useAuthStore } from "./authStore";

// How many feed events other people caused since I last opened Notifications.
// Shared by the sidebar badge and the page.
interface NotificationsState {
  unread: number;
  /** Bumped by markSeen, so a count fetched before it can't overwrite the 0. */
  seenVersion: number;
  load: () => Promise<void>;
  markSeen: () => Promise<void>;
  clear: () => void;
}

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  unread: 0,
  seenVersion: 0,
  load: async () => {
    const version = get().seenVersion;
    try {
      const { count } = await apiAuthGet<{ count: number }>("/api/notifications/unread-count");
      if (get().seenVersion === version) set({ unread: count });
    } catch {
      // A badge isn't worth an error message; the next load tries again.
    }
  },
  markSeen: async () => {
    set((s) => ({ unread: 0, seenVersion: s.seenVersion + 1 }));
    await apiAuthPost("/api/notifications/seen", {}).catch(() => undefined);
  },
  clear: () => set({ unread: 0 }),
}));

useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) useNotificationsStore.getState().clear();
});
