import { ArrowRight, Check, CircleCheck } from "lucide-react";
import { rupees, formatDate } from "@/lib/format";
import type { FundDetail, FundEntry } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

// After closing: the payments that square everyone up. The collector marks
// each one done once the money has changed hands.
export function FundSettlementCard({
  fund,
  currentUserId,
  onDone,
}: {
  fund: FundDetail;
  currentUserId?: string;
  onDone: (entry: FundEntry) => void;
}) {
  const transfers = fund.entries.filter((e) => e.kind === "refund" || e.kind === "collection");
  const collector = fund.collector.id === currentUserId ? "You" : fund.collector.name;
  const nameOf = (e: FundEntry) => (e.member_id === currentUserId ? "You" : (e.member_name ?? "Former member"));
  const allDone = transfers.every((t) => t.confirmed);

  return (
    <Card className="rounded-3xl p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h2 className="font-semibold">Final settlement</h2>
        <Badge tone={allDone ? "success" : "accent"}>{allDone ? "All settled" : "In progress"}</Badge>
      </div>
      <p className="text-xs text-foreground/50 mb-4">
        Closed {fund.closedAt ? formatDate(fund.closedAt) : ""}. Everyone has now paid an equal share of what was spent.
      </p>
      {transfers.length === 0 ? (
        <p className="text-sm text-foreground/60">Nobody owed anything - it was already even.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {transfers.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm rounded-2xl bg-foreground/3 px-3 py-2.5">
              <span className="font-medium">{t.kind === "refund" ? collector : nameOf(t)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
              <span className="font-medium">{t.kind === "refund" ? nameOf(t) : collector}</span>
              <span className="ml-auto font-semibold text-primary">{rupees(t.amount_paise)}</span>
              {t.confirmed ? (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <CircleCheck className="h-4 w-4" /> Done
                </span>
              ) : fund.canManage ? (
                <Button size="sm" variant="outline" className="h-8! px-3! text-xs" onClick={() => onDone(t)}>
                  <Check className="h-3.5 w-3.5" /> Mark done
                </Button>
              ) : (
                <span className="text-xs text-foreground/50">Pending</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
