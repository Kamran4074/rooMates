"use client";

import Link from "next/link";
import { useApiQuery } from "@/lib/useApiQuery";
import type { AdminGroupMember, RoomType } from "@/lib/types";
import { Skeleton } from "@/components/ui/Skeleton";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { GroupMemberList } from "@/components/admin/GroupMemberList";

interface OwnedGroup {
  id: string;
  name: string;
  type: RoomType;
  created_at: string;
  members: AdminGroupMember[];
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
          <GroupMemberList members={g.members} />
        </div>
      ))}
    </div>
  );
}
