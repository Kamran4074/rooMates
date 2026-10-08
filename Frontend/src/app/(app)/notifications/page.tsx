"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { formatDate } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import { useLiveRefresh } from "@/lib/live";
import type { ActivityEvent } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { useRoomsStore } from "@/store/roomsStore";
import { useNotificationsStore } from "@/store/notificationsStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Skeleton";
import { FundApprovalsCard } from "@/components/funds/FundApprovalsCard";
import { ActivityItem } from "@/components/notifications/ActivityItem";

// "Today" / "Yesterday" / "8 October 2026", in India time like the rest of the app.
function dayLabel(iso: string) {
  const day = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  const d = new Date(iso);
  if (day(d) === day(today)) return "Today";
  if (day(d) === day(yesterday)) return "Yesterday";
  return formatDate(iso);
}

// Everything that happened in my rooms - who added, paid, approved or
// disputed what - plus payments waiting for my approval at the top.
// The feed is written by the database itself and can't be edited: it's the record.
export default function NotificationsPage() {
  const myId = useAuthStore((s) => s.user?.id);
  const rooms = useRoomsStore((s) => s.rooms);
  const markSeen = useNotificationsStore((s) => s.markSeen);
  const [roomId, setRoomId] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, reload } = usePagedQuery<ActivityEvent>(`/api/notifications?page=${page}&limit=30${roomId ? `&roomId=${roomId}` : ""}`);
  // New events while the page is open: show them, and they count as read.
  useLiveRefresh(() => {
    reload();
    markSeen();
  });

  // Opening the page reads everything; this load still shows what was new.
  const loaded = !!data;
  useEffect(() => {
    if (loaded) markSeen();
  }, [loaded, markSeen]);

  const groups: { label: string; items: ActivityEvent[] }[] = [];
  for (const e of data?.items ?? []) {
    const label = dayLabel(e.created_at);
    if (groups.at(-1)?.label === label) groups.at(-1)!.items.push(e);
    else groups.push({ label, items: [e] });
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Everything that happens in your rooms: who added, paid, approved or disputed what."
        actions={
          rooms.length > 1 && (
            <div className="w-48">
              <Select aria-label="Room" value={roomId} onChange={(e) => { setRoomId(e.target.value); setPage(1); }}>
                <option value="">All rooms</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </div>
          )
        }
      />

      <FundApprovalsCard />

      {error ? (
        <p className="text-danger">{error}</p>
      ) : !data ? (
        <LoadingState variant="list" />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title="Nothing yet">
          Expenses, payments and fund activity in your rooms will show up here.
        </EmptyState>
      ) : (
        <Card className="rounded-3xl p-3 sm:p-4">
          {groups.map((g) => (
            <section key={g.label} className="mb-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/45 px-3 pt-3 pb-1">{g.label}</h2>
              <ul>
                {g.items.map((e) => (
                  <ActivityItem key={e.id} event={e} myId={myId} showRoom={!roomId && rooms.length > 1} />
                ))}
              </ul>
            </section>
          ))}
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </>
  );
}
