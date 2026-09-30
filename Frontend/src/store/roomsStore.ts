import { create } from "zustand";
import { apiAuthGet, errorMessage } from "@/lib/api";
import type { RoomListItem } from "@/lib/types";
import { useAuthStore } from "./authStore";

// Shared by the sidebar and the dashboard so they show the same list and
// creating/joining a room refreshes both from a single fetch.
interface RoomsState {
  rooms: RoomListItem[];
  loaded: boolean;
  error: string | null;
  load: () => Promise<void>;
  clear: () => void;
}

export const useRoomsStore = create<RoomsState>()((set) => ({
  rooms: [],
  loaded: false,
  error: null,
  load: async () => {
    try {
      set({ rooms: await apiAuthGet<RoomListItem[]>("/api/rooms"), loaded: true, error: null });
    } catch (err) {
      set({ loaded: true, error: errorMessage(err, "Failed to load rooms") });
    }
  },
  clear: () => set({ rooms: [], loaded: false, error: null }),
}));

// Drop cached rooms whenever the session ends - explicit logout AND a failed
// token refresh both go through authStore.logout(), so neither can leave the
// previous account's rooms on screen for whoever signs in next.
useAuthStore.subscribe((state, prev) => {
  if (prev.accessToken && !state.accessToken) useRoomsStore.getState().clear();
});
