import { create } from "zustand";

// Small pop-up messages in the corner (e.g. "Ravi added WiFi bill · ₹900"
// arriving live). Rendered by components/ui/Toaster.
export interface Toast {
  id: number;
  message: string;
  /** Optional link the toast opens. */
  href?: string;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, href?: string) => void;
  dismiss: (id: number) => void;
}

const VISIBLE_MS = 6_000;
const MAX_VISIBLE = 3;
let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  show: (message, href) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, href }].slice(-MAX_VISIBLE) }));
    setTimeout(() => get().dismiss(id), VISIBLE_MS);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
