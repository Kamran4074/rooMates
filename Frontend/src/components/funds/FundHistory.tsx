import { ArrowDownLeft, ArrowUpRight, Check, Trash2, X } from "lucide-react";
import { rupees, formatDate } from "@/lib/format";
import type { FundDetail, FundEntry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// Payments in and spends out. Payments a member recorded themselves show as
// "waiting" with confirm / reject buttons for the collector.
// (Refunds/collections from closing are shown in FundSettlementCard instead.)
export function FundHistory({
  fund,
  currentUserId,
  onConfirm,
  onDelete,
}: {
  fund: FundDetail;
  currentUserId?: string;
  onConfirm: (entry: FundEntry) => void;
  onDelete: (entry: FundEntry, isReject: boolean) => void;
}) {
  const open = fund.status === "open";
  const entries = fund.entries.filter((e) => e.kind === "contribution" || e.kind === "spend");

  return (
    <Card className="rounded-3xl p-6">
      <h2 className="font-semibold mb-4">History</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-foreground/55">No payments yet. Record the first one when someone pays.</p>
      ) : (
        <ul className="divide-y divide-card-border">
          {entries.map((entry) => {
            const isIn = entry.kind === "contribution";
            const waiting = isIn && !entry.confirmed;
            const canReview = open && waiting && fund.canManage;
            const canDelete = open && entry.created_by === currentUserId && !canReview;
            return (
              <li key={entry.id} className={`flex items-center gap-3 py-3 ${waiting ? "opacity-80" : ""}`}>
                <span
                  className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                    isIn ? "bg-success/10 text-success" : "bg-accent/15 text-accent"
                  }`}
                >
                  {isIn ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{isIn ? `${entry.member_name ?? "Former member"} paid` : entry.note}</p>
                  <p className="text-xs text-foreground/50 truncate">
                    {formatDate(entry.created_at, "short")}
                    {isIn && entry.note && ` · ${entry.note}`}
                    {!isIn && ` · by ${entry.created_by === currentUserId ? "you" : (entry.created_by_name ?? "former member")}`}
                  </p>
                  {waiting && (
                    <span className="inline-block mt-1">
                      <Badge tone="accent">Waiting for {fund.collector.name.split(" ")[0]} to confirm</Badge>
                    </span>
                  )}
                </div>
                <span className={`text-sm font-semibold ${isIn && !waiting ? "text-success" : ""}`}>
                  {isIn ? "+" : "−"}
                  {rupees(entry.amount_paise)}
                </span>
                {canReview && (
                  <>
                    <button
                      onClick={() => onConfirm(entry)}
                      className="p-1.5 rounded-full text-success hover:bg-success/10"
                      aria-label="Confirm payment received"
                      title="Got it"
                    >
                      <Check className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(entry, true)}
                      className="p-1.5 rounded-full text-foreground/40 hover:text-danger hover:bg-danger/10"
                      aria-label="Reject payment"
                      title="Didn't receive it"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    onClick={() => onDelete(entry, false)}
                    className="p-1.5 rounded-full text-foreground/35 hover:text-danger hover:bg-danger/10"
                    aria-label="Delete entry"
                  >
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
