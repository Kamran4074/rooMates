"use client";

import { useEffect, useRef } from "react";
import { apiAuthStream } from "./api";
import { useLiveStore } from "@/store/liveStore";
import { useApprovalsStore } from "@/store/approvalsStore";
import { useNotificationsStore } from "@/store/notificationsStore";
import { useRoomsStore } from "@/store/roomsStore";

// Live updates from the API's event stream (Server-Sent Events).
// fetch() instead of EventSource so the Authorization header can be sent.
// Each "activity" event means "something changed in room X": badges and the
// rooms list reload, and pages watching that room refetch (useLiveRefresh).
//
// A hidden tab lets go of the stream after a minute: an open connection keeps
// a free-tier server (and its database) awake around the clock. Coming back
// reconnects and refetches, since events may have been missed meanwhile.

const MAX_BACKOFF_MS = 30_000;
const HIDDEN_GRACE_MS = 60_000;

function reloadShared() {
  useApprovalsStore.getState().load();
  useNotificationsStore.getState().load();
  useRoomsStore.getState().load(); // dashboard / sidebar balances
}

// Splits the stream into events ("event: x\ndata: {...}\n\n"); comment lines (": ping") are ignored.
function parse(block: string): { event: string; data: string } | null {
  let event = "message";
  let data = "";
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  return data ? { event, data } : null;
}

export function useLiveConnection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let controller: AbortController | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let connectedBefore = false;

    async function connect() {
      const mine = new AbortController();
      controller = mine;
      try {
        const res = await apiAuthStream("/api/notifications/stream", mine.signal);
        if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let cut: number;
          while ((cut = buffer.indexOf("\n\n")) !== -1) {
            const msg = parse(buffer.slice(0, cut));
            buffer = buffer.slice(cut + 2);
            if (msg?.event === "ready") {
              attempt = 0;
              // Back after a gap: catch up on whatever happened meanwhile.
              if (connectedBefore) {
                useLiveStore.getState().bumpAll();
                reloadShared();
              }
              connectedBefore = true;
            } else if (msg?.event === "activity") {
              useLiveStore.getState().bump((JSON.parse(msg.data) as { room_id: string }).room_id);
              reloadShared();
            }
          }
        }
      } catch {
        // Aborted (unmount / hidden tab) or the connection failed: see below.
      }
      if (mine.signal.aborted || controller !== mine) return;
      retry = setTimeout(connect, Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** attempt++));
    }

    function disconnect() {
      controller?.abort();
      controller = null;
      clearTimeout(retry);
    }

    function onVisibility() {
      clearTimeout(hiddenTimer);
      if (document.visibilityState === "hidden") {
        hiddenTimer = setTimeout(disconnect, HIDDEN_GRACE_MS);
      } else if (!controller) {
        attempt = 0;
        connect();
      }
    }

    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(hiddenTimer);
      disconnect();
    };
  }, [enabled]);
}

// Calls `refresh` when a live update arrives - for one room, or any room when
// roomId is omitted - and after a reconnect. The callback can change every
// render; only the counter triggers it.
export function useLiveRefresh(refresh: () => void, roomId?: string) {
  const counter = useLiveStore((s) => (roomId ? (s.rooms[roomId] ?? 0) : s.tick) + s.resync);
  const latest = useRef(refresh);
  useEffect(() => {
    latest.current = refresh;
  });
  useEffect(() => {
    if (counter > 0) latest.current();
  }, [counter]);
}
