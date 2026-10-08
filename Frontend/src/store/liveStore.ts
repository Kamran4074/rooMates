import { create } from "zustand";

// Counters bumped by live updates (lib/live.ts). Pages watch the counter for
// their room - or the global one - and quietly refetch when it moves.
interface LiveState {
  /** Bumped on every event, in any room. */
  tick: number;
  /** Bumped per room. */
  rooms: Record<string, number>;
  /** Bumped after reconnecting: events may have been missed, so everyone refetches. */
  resync: number;
  bump: (roomId: string) => void;
  bumpAll: () => void;
}

export const useLiveStore = create<LiveState>()((set) => ({
  tick: 0,
  rooms: {},
  resync: 0,
  bump: (roomId) => set((s) => ({ tick: s.tick + 1, rooms: { ...s.rooms, [roomId]: (s.rooms[roomId] ?? 0) + 1 } })),
  bumpAll: () => set((s) => ({ resync: s.resync + 1 })),
}));
