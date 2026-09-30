import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// false on the server and during the hydration render, true afterwards.
// The auth store is persisted to localStorage and zustand rehydrates it
// synchronously on the client, so anything that renders differently based on
// it must wait for this - otherwise the client's first render (logged in)
// won't match the server's HTML (logged out) and React throws a hydration error.
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}
