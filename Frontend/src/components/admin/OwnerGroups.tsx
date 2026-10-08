"use client";

import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import type { RoomType } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { RoomIcon } from "@/components/rooms/RoomIcon";

interface GroupMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  picture: string | null;
  role: "admin" | "member";
  joined_at: string;
  last_active_at: string | null;
  suspended_at: string | null;
  deleted_at: string | null;
}

interface OwnedGroup {
  id: string;
  name: string;
  type: RoomType;
  created_at: string;
  members: GroupMember[];
}

// The expanded part of an owner's row in the users table: each group they
// run and who's in it. Loaded only when the row is opened.
export function OwnerGroups({ userId }: { userId: string }) {
  const { data, error } = useApiQuery<OwnedGroup[]>(`/api/admin/users/${userId}/groups`);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (!data) return <Skeleton className="h-16 w-full rounded-2xl" />;
  if (data.length === 0) return <p className="text-sm text-foreground/55">Not running any group yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      {data.map((g) => (
        <div key={g.id} className="rounded-2xl border border-card-border bg-background/40 p-3">
          <Link href={`/admin/rooms/${g.id}`} className="flex items-center gap-2 mb-2 hover:text-primary">
            <RoomIcon type={g.type} size="sm" />
            <span className="font-medium">{g.name}</span>
            <span className="text-xs text-foreground/50">
              {g.type === "trip" ? "Trip" : "Flat"} · {g.members.length} {g.members.length === 1 ? "person" : "people"}
            </span>
          </Link>
          <ul className="flex flex-col">
            {g.members.map((m) => (
              <li key={m.id}>
                <Link href={`/admin/users/${m.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded-xl px-2 py-1.5 hover:bg-foreground/5">
                  <Avatar name={m.name} picture={m.picture} size={28} />
                  <span className="text-sm font-medium min-w-28">{m.name}</span>
                  {m.role === "admin" && <Badge tone="primary">Owner</Badge>}
                  {m.suspended_at && <Badge tone="danger">Suspended</Badge>}
                  {m.deleted_at && <Badge>Deleted</Badge>}
                  <span className="text-xs text-foreground/55 truncate max-w-60">{m.email ?? "—"}</span>
                  <span className="text-xs text-foreground/55">{m.phone ?? ""}</span>
                  <span className="text-xs text-foreground/45 ml-auto">Active {timeAgo(m.last_active_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
