"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
import { rupees, formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Balance, RoomType, Settlement } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { RoomIcon } from "@/components/rooms/RoomIcon";

interface AdminRoomDetail {
  id: string;
  name: string;
  type: RoomType;
  created_at: string;
  members: { user_id: string; role: string; name: string; email: string }[];
  recent_expenses: { id: string; description: string; amount_paise: number; created_at: string; paid_by_name: string | null }[];
  balances: Balance[];
  settlements: Settlement[];
}

export default function AdminRoomPage() {
  const { id } = useParams<{ id: string }>();
  const { data: room, error } = useApiQuery<AdminRoomDetail>(`/api/admin/rooms/${id}`);
  if (error) return <p className="text-danger">{error}</p>;
  if (!room) return <p className="text-foreground/50">Loading...</p>;

  return (
    <>
      <Link href="/admin/rooms" className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Rooms
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <RoomIcon type={room.type} /> {room.name}
          </span>
        }
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Eye className="h-4 w-4" /> Read-only view · created {formatDate(room.created_at)}
          </span>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl p-6">
          <h2 className="font-semibold mb-3">Recent expenses</h2>
          {room.recent_expenses.length === 0 ? (
            <p className="text-sm text-foreground/55">No expenses.</p>
          ) : (
            <ul className="divide-y divide-card-border">
              {room.recent_expenses.map((e) => (
                <li key={e.id} className="py-2.5 flex items-center gap-3">
                  <span className="text-xs text-foreground/45 w-12 shrink-0">{formatDate(e.created_at, "short")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{e.description}</p>
                    <p className="text-xs text-foreground/50">Paid by {e.paid_by_name ?? "former member"}</p>
                  </div>
                  <span className="font-semibold">{rupees(e.amount_paise)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold mb-3">Members</h2>
            <ul className="flex flex-col gap-2">
              {room.members.map((m) => {
                const net = room.balances.find((b) => b.userId === m.user_id)?.netPaise ?? 0;
                return (
                  <li key={m.user_id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {m.name} {m.role === "admin" && <Badge tone="primary">Admin</Badge>}
                      </p>
                      <p className="text-xs text-foreground/50 truncate">{m.email}</p>
                    </div>
                    <span className={net > 0 ? "text-success" : net < 0 ? "text-danger" : "text-foreground/45"}>
                      {net === 0 ? "settled" : `${net > 0 ? "+" : "−"}${rupees(net)}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold mb-3">Settle-up plan</h2>
            {room.settlements.length === 0 ? (
              <p className="text-sm text-foreground/55">Everyone&apos;s settled.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {room.settlements.map((s) => (
                  <li key={`${s.fromUserId}-${s.toUserId}`} className="flex items-center gap-2 text-sm">
                    <span className="truncate">{s.fromName}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                    <span className="truncate">{s.toName}</span>
                    <span className="ml-auto font-semibold text-primary">{rupees(s.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
