"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, Flag } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatDate, rupees } from "@/lib/format";
import type { FundApproval } from "@/lib/types";
import { confirmFundEntry, disputeFundEntry } from "@/services/fundsApi";
import { useApprovalsStore } from "@/store/approvalsStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { ReasonModal } from "@/components/ui/ReasonModal";

// "Kamran recorded that you paid ₹1,500 into the Goa kitty - is that right?"
// The member's half of a two-sided payment. Approving makes it count;
// disputing keeps it on record, with the reason, without counting it.
// Renders nothing when there's nothing to approve.
export function FundApprovalsCard({ onChanged }: { onChanged?: () => void }) {
  const items = useApprovalsStore((s) => s.items);
  const reload = useApprovalsStore((s) => s.load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [disputing, setDisputing] = useState<FundApproval | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function approve(a: FundApproval) {
    setError(null);
    setBusyId(a.id);
    try {
      await confirmFundEntry(a.room_id, a.fund_id, a.id);
      await reload();
      onChanged?.();
    } catch (err) {
      setError(errorMessage(err, "Couldn't approve that"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card className="rounded-3xl p-6 mb-6 border-primary/40 bg-primary/5">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <BellRing className="h-4 w-4 text-primary" /> Check {items.length === 1 ? "this payment" : `these ${items.length} payments`}
      </h2>
      <p className="text-xs text-foreground/55 mb-4">
        Someone recorded money you paid into a fund. Approve it if it&apos;s right; it counts once you do.
      </p>
      <ul className="flex flex-col gap-3">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card border border-card-border px-4 py-3">
            <div className="flex-1 min-w-52">
              <p className="text-sm">
                <span className="font-medium">{a.recorded_by_name}</span> recorded that you paid{" "}
                <span className="font-semibold">{rupees(a.amount_paise)}</span> into{" "}
                <Link href={`/rooms/${a.room_id}/fund`} className="font-medium text-primary">
                  {a.fund_name}
                </Link>
              </p>
              <p className="text-xs text-foreground/50">
                {a.room_name} · {formatDate(a.created_at, "short")}
                {a.note && ` · ${a.note}`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setDisputing(a)} disabled={busyId === a.id}>
                <Flag className="h-4 w-4" /> Not right
              </Button>
              <Button size="sm" variant="dark" onClick={() => approve(a)} loading={busyId === a.id}>
                <Check className="h-4 w-4" /> Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <FormMessage error={error} />
      </div>

      <ReasonModal
        open={!!disputing}
        title="Dispute this payment?"
        label="What's wrong?"
        confirmLabel="Dispute payment"
        danger
        description={
          disputing && (
            <>
              {disputing.recorded_by_name} recorded {rupees(disputing.amount_paise)} for you in {disputing.fund_name}. A disputed payment
              doesn&apos;t count, and it stays in the fund&apos;s history with your reason.
            </>
          )
        }
        onClose={() => setDisputing(null)}
        onConfirm={async (note) => {
          await disputeFundEntry(disputing!.room_id, disputing!.fund_id, disputing!.id, note);
          await reload();
          onChanged?.();
        }}
      />
    </Card>
  );
}
