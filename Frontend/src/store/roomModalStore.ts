import { create } from "zustand";

// Lets any part of the app shell (sidebar, dashboard, empty states) open the
// same create/join room dialogs, which are rendered once in the app layout.
interface RoomModalState {
  open: "create" | "join" | null;
  show: (modal: "create" | "join") => void;
  close: () => void;
}

export const useRoomModal = create<RoomModalState>()((set) => ({
  open: null,
  show: (modal) => set({ open: modal }),
  close: () => set({ open: null }),
}));
