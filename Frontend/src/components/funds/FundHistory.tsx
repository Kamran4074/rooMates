import { ArrowDownLeft, ArrowUpRight, Check, Flag, Trash2, X } from "lucide-react";
import { rupees, formatDate } from "@/lib/format";
import type { FundDetail, FundEntry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

const first = (name?: string | null) => (name ?? "someone").split(" ")[0];

// Recorded by the collector/admin about someone else -> that person approves it.
const recordedForMember = (e: FundEntry) => e.kind === "contribution" && e.created_by !== e.member_id;

// Payments in and spends out, with the proof trail on every payment: who
// recorded it, who agreed it's right (and when), or who disputed it and why.
//   member's own record        -> collector/admin: confirm (✓) or reject (✕)
//   collector's record for you -> you: approve (✓) or dispute (⚑)
// (Refunds/collections from closing are shown in FundSettlementCard instead.)
export function FundHistory({
  fund,
  currentUserId,
  onConfirm,
  onDelete,
  onDispute,
}: {
  fund: FundDetail;
  currentUserId?: string;
  onConfirm: (entry: FundEntry) => void;
  onDelete: (entry: FundEntry, isReject: boolean) => void;
  onDispute: (entry: FundEntry) => void;
}) {
  const open = fund.status === "open";
  const entries = fund.entries.filter((e) => e.kind === "contribution" || e.kind === "spend");
  const you = (id: string | null, name: string | null) => (id === currentUserId ? "you" : first(name));

  return (
    <Card className="rounded-3xl p-6">
      <h2 className="font-semibold mb-4">History</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-foreground/55">No payments yet. Record the first one when someone pays.</p>
      ) : (
        <ul className="divide-y divide-card-border">
          {entries.map((entry) => {
            const isIn = entry.kind === "contribution";
            const disputed = !!entry.disputed_at;
            const waiting = isIn && !entry.confirmed && !disputed;
            const forMember = recordedForMember(entry);
            // Whose turn it is to agree.
            const iApprove = open && waiting && forMember && entry.member_id === currentUserId;
            const iConfirm = open && waiting && !forMember && fund.canManage;
            const canDelete = open && !disputed && entry.created_by === currentUserId && !iConfirm;

            return (
              <li key={entry.id} className={`flex items-start gap-3 py-3 ${waiting || disputed ? "opacity-85" : ""}`}>
                <span
                  className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                    disputed ? "bg-danger/10 text-danger" : isIn ? "bg-success/10 text-success" : "bg-accent/15 text-accent"
                  }`}
                >
                  {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{isIn ? `${entry.member_name ?? "Former member"} paid` : entry.note}</p>
                  <p className="text-xs text-foreground/50">
                    {formatDate(entry.created_at, "short")} · recorded by {you(entry.created_by, entry.created_by_name)}
                    {isIn && entry.note && ` · ${entry.note}`}
                  </p>
                  {isIn && entry.confirmed && entry.confirmed_by_name && entry.confirmed_at && (
                    <p className="text-xs text-success/90">
                      ✓ {forMember ? "Approved" : "Confirmed"} by {first(entry.confirmed_by_name)}, {formatDate(entry.confirmed_at, "short")}
                    </p>
                  )}
                  {waiting && (
                    <span className="inline-block mt-1">
                      <Badge tone="accent">
                        {forMember
                          ? entry.member_id === currentUserId
                            ? "Waiting for your approval"
                            : `Waiting for ${first(entry.member_name)} to approve`
                          : `Waiting for ${first(fund.collector.name)} to confirm`}
                      </Badge>
                    </span>
                  )}
                  {disputed && (
                    <p className="text-xs text-danger mt-1">
                      Disputed by {first(entry.disputed_by_name)}
                      {entry.disputed_at && `, ${formatDate(entry.disputed_at, "short")}`}: “{entry.dispute_note}”
                    </p>
                  )}
                </div>
                <span className={`text-sm font-semibold ${disputed ? "line-through text-foreground/40" : isIn && !waiting ? "text-success" : ""}`}>
                  {isIn ? "+" : "−"}
                  {rupees(entry.amount_paise)}
                </span>
                {iApprove && (
                  <>
                    <button onClick={() => onConfirm(entry)} className="p-1.5 rounded-full text-success hover:bg-success/10" aria-label="Approve: yes, I paid this" title="Yes, I paid this">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDispute(entry)} className="p-1.5 rounded-full text-foreground/40 hover:text-danger hover:bg-danger/10" aria-label="Dispute this payment" title="That's not right">
                      <Flag className="h-4 w-4" />
                    </button>
                  </>
                )}
                {iConfirm && (
                  <>
                    <button onClick={() => onConfirm(entry)} className="p-1.5 rounded-full text-success hover:bg-success/10" aria-label="Confirm payment received" title="Got it">
                      <Check className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDelete(entry, true)} className="p-1.5 rounded-full text-foreground/40 hover:text-danger hover:bg-danger/10" aria-label="Reject payment" title="Didn't receive it">
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button onClick={() => onDelete(entry, false)} className="p-1.5 rounded-full text-foreground/35 hover:text-danger hover:bg-danger/10" aria-label="Delete entry">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
