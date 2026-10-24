import Link from "next/link";
import { timeAgo } from "@/lib/format";
import type { AdminGroupMember } from "@/lib/types";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

// The people in one group, owner first, each linking to their user page.
// Shared by the Users table's expanded rows: "Group owners" and "Groups".
export function GroupMemberList({ members }: { members: AdminGroupMember[] }) {
  return (
    <ul className="flex flex-col">
      {members.map((m) => (
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
  );
}
