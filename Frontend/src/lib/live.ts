"use client";

import { useEffect, useRef } from "react";
import { liveSocketUrl, refreshSession } from "./api";
import { describeActivity } from "./activityText";
import type { ActivityEvent } from "./types";
import { useAuthStore } from "@/store/authStore";
import { useLiveStore } from "@/store/liveStore";
import { useApprovalsStore } from "@/store/approvalsStore";
import { useNotificationsStore } from "@/store/notificationsStore";
import { useJoinRequestsStore } from "@/store/joinRequestsStore";
import { useRoomsStore } from "@/store/roomsStore";
import { useToastStore } from "@/store/toastStore";

// Live updates over WebSocket (the API's /api/ws, see Backend config/realtime.ts).
//  - The first message is the access token (browsers can't send headers on a
//    WebSocket, and a token in the URL would end up in logs).
//  - Each "activity" message is one feed event: badges and the rooms list
//    reload, pages watching that room refetch (useLiveRefresh), and if someone
//    else did it, a toast says what happened.
//  - Dropped connections reconnect with backoff; an expired token is refreshed
//    first (close code 4001).
//  - A tab hidden for a minute lets go of the socket: an open connection keeps
//    a free-tier server (and its database) awake around the clock. Coming back
//    reconnects and refetches, since events may have been missed meanwhile.

const MAX_BACKOFF_MS = 30_000;
const HIDDEN_GRACE_MS = 60_000;
const CLOSE_AUTH_FAILED = 4001;
const CLOSE_TOO_MANY = 4002;

function reloadShared() {
  useApprovalsStore.getState().load();
  useNotificationsStore.getState().load();
  useJoinRequestsStore.getState().load();
  useRoomsStore.getState().load(); // dashboard / sidebar balances, a newly approved room
}

function onActivity(event: ActivityEvent) {
  useLiveStore.getState().bump(event.room_id);
  reloadShared();
  const myId = useAuthStore.getState().user?.id;
  if (event.actor_id !== myId) {
    // A declined requester isn't a member, so there's no room page to open.
    const href =
      event.type === "join_rejected" ? undefined : event.data.fund_id ? `/rooms/${event.room_id}/fund` : `/rooms/${event.room_id}`;
    useToastStore.getState().show(`${describeActivity(event, myId)} · ${event.room_name}`, href);
  }
}

export function useLiveConnection(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let hiddenTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let connectedBefore = false;
    let stopped = false;

    function scheduleReconnect(delay = Math.min(MAX_BACKOFF_MS, 1_000 * 2 ** attempt++)) {
      clearTimeout(retry);
      if (!stopped) retry = setTimeout(connect, delay);
    }

    function connect() {
      const token = useAuthStore.getState().accessToken;
      if (!token || stopped) return;
      const ws = new WebSocket(liveSocketUrl());
      socket = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "auth", token }));
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data as string) as { type: string; event?: ActivityEvent };
        if (data.type === "ready") {
          attempt = 0;
          // Back after a gap: catch up on whatever happened meanwhile.
          if (connectedBefore) {
            useLiveStore.getState().bumpAll();
            reloadShared();
          }
          connectedBefore = true;
        } else if (data.type === "activity" && data.event) {
          onActivity(data.event);
        }
      };
      ws.onclose = async (e) => {
        if (socket !== ws || stopped) return; // replaced or shut down on purpose
        socket = null;
        if (e.code === CLOSE_AUTH_FAILED) {
          // Usually an expired access token: refresh, then try again right away.
          if (await refreshSession()) scheduleReconnect(0);
          return;
        }
        scheduleReconnect(e.code === CLOSE_TOO_MANY ? MAX_BACKOFF_MS : undefined);
      };
    }

    function disconnect() {
      clearTimeout(retry);
      const ws = socket;
      socket = null;
      ws?.close();
    }

    function onVisibility() {
      clearTimeout(hiddenTimer);
      if (document.visibilityState === "hidden") {
        hiddenTimer = setTimeout(disconnect, HIDDEN_GRACE_MS);
      } else if (!socket) {
        attempt = 0;
        connect();
      }
    }

    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
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
