import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { RoomDetail } from "@/lib/types";

// Shown to the room admin once the room has as many people as its plan
// allows: new join requests are turned away until it's upgraded.
export function RoomFullNote({ room }: { room: Pick<RoomDetail, "member_count" | "max_members" | "plan"> }) {
  if (room.member_count < room.max_members) return null;
  return (
    <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">
      <p className="font-medium">This room is full</p>
      <p className="text-foreground/60 text-xs mt-0.5">
        The {room.plan} plan allows {room.max_members} people per room, so new join requests are turned away.
      </p>
      <Link href="/contact" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
        <Sparkles className="h-3.5 w-3.5" /> Upgrade to add more people
      </Link>
    </div>
  );
}
