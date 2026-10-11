"use client";

import { useState } from "react";
import { Check, Clock, UserPlus, X } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { approveJoinRequest, rejectJoinRequest } from "@/services/joinRequestsApi";
import { useJoinRequestsStore } from "@/store/joinRequestsStore";
import { useRoomsStore } from "@/store/roomsStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { FormMessage } from "@/components/ui/FormMessage";

// People asking to join rooms I run (approve / decline), and - unless shown
// for one room - my own requests still waiting for an admin.
// Renders nothing when there's nothing to show.
export function JoinRequestsCard({ roomId, onChanged }: { roomId?: string; onChanged?: () => void }) {
  const allToApprove = useJoinRequestsStore((s) => s.toApprove);
  const allMine = useJoinRequestsStore((s) => s.mine);
  const reload = useJoinRequestsStore((s) => s.load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toApprove = roomId ? allToApprove.filter((r) => r.room_id === roomId) : allToApprove;
  const mine = roomId ? [] : allMine;
  if (toApprove.length === 0 && mine.length === 0) return null;

  async function decide(roomOf: string, requestId: string, approve: boolean) {
    setError(null);
    setBusyId(requestId);
    try {
      await (approve ? approveJoinRequest(roomOf, requestId) : rejectJoinRequest(roomOf, requestId));
      await reload();
      useRoomsStore.getState().load();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save that"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="rounded-3xl p-6 mb-6 border-accent/40 bg-accent/5">
      {toApprove.length > 0 && (
        <>
          <h2 className="font-semibold flex items-center gap-2 mb-1">
            <UserPlus className="h-4 w-4 text-accent" /> {toApprove.length === 1 ? "Someone wants to join" : `${toApprove.length} people want to join`}
          </h2>
          <p className="text-xs text-foreground/55 mb-4">Only people you approve can see the room and its money.</p>
          <ul className="flex flex-col gap-3">
            {toApprove.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card border border-card-border px-4 py-3">
                <Avatar name={r.name} picture={r.picture} size={36} />
                <div className="flex-1 min-w-44">
                  <p className="text-sm">
                    <span className="font-medium">{r.name}</span> wants to join <span className="font-medium">{r.room_name}</span>
                  </p>
                  <p className="text-xs text-foreground/50">
                    {r.email} · {timeAgo(r.created_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide(r.room_id, r.id, false)} disabled={busyId === r.id}>
                    <X className="h-4 w-4" /> Decline
                  </Button>
                  <Button size="sm" variant="dark" onClick={() => decide(r.room_id, r.id, true)} loading={busyId === r.id}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {mine.length > 0 && (
        <div className={toApprove.length > 0 ? "mt-5" : ""}>
          <h2 className="font-semibold flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-accent" /> Waiting for approval
          </h2>
          <ul className="flex flex-col gap-2">
            {mine.map((r) => (
              <li key={r.id} className="text-sm rounded-2xl bg-card border border-card-border px-4 py-3">
                You asked to join <span className="font-medium">{r.room_name}</span> {timeAgo(r.created_at)}. You&apos;ll get in once
                its admin approves.
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3">
        <FormMessage error={error} />
      </div>
    </Card>
  );
}
