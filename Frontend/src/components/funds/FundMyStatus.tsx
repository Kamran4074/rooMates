import { CheckCircle2, Clock, HandCoins } from "lucide-react";
import { rupees } from "@/lib/format";
import type { FundDetail } from "@/lib/types";
import { Button } from "@/components/ui/Button";

const first = (name: string) => name.split(" ")[0];

// The answer to "what do I have to do?" at the top of a fund:
//   a member: what they've paid, what's still due, and who to pay;
//   the collector/admin: who still owes and what's waiting for their OK.
export function FundMyStatus({ fund, myId, onPay }: { fund: FundDetail; myId?: string; onPay: () => void }) {
  if (fund.status !== "open") return null;
  const me = fund.members.find((m) => m.userId === myId);
  const collectorIsMe = fund.collector.id === myId;
  const owing = fund.members.filter((m) => m.userId !== fund.collector.id && m.pendingPaise > 0);
  const toConfirm = fund.entries.filter((e) => e.kind === "contribution" && !e.confirmed && !e.disputed_at && e.created_by === e.member_id).length;

  return (
    <div className="flex flex-col gap-3 mb-6">
      {me && !collectorIsMe && (() => {
        const due = Math.max(me.pendingPaise - me.awaitingPaise, 0);
        // Still owe / recorded but not confirmed yet / paid.
        const state = due > 0 ? "owe" : me.awaitingPaise > 0 ? "waiting" : "paid";
        const tone = { owe: "border-danger/30 bg-danger/5", waiting: "border-accent/30 bg-accent/5", paid: "border-success/30 bg-success/5" }[state];
        return (
          <div className={`rounded-3xl border p-5 flex flex-wrap items-center gap-4 ${tone}`}>
            {state === "owe" ? (
              <HandCoins className="h-6 w-6 text-danger shrink-0" />
            ) : state === "waiting" ? (
              <Clock className="h-6 w-6 text-accent shrink-0" />
            ) : (
              <CheckCircle2 className="h-6 w-6 text-success shrink-0" />
            )}
            <div className="flex-1 min-w-52">
              <p className="font-semibold">
                {state === "owe"
                  ? `You still owe ${rupees(due)} - pay ${first(fund.collector.name)}`
                  : state === "waiting"
                    ? `Your ${rupees(me.awaitingPaise)} is recorded - waiting for confirmation`
                    : "You've paid your share"}
              </p>
              <p className="text-sm text-foreground/60">
                Paid {rupees(me.paidPaise)} of {rupees(fund.perMemberPaise)}
                {me.awaitingPaise > 0 && ` · ${rupees(me.awaitingPaise)} waiting for confirmation`}
              </p>
            </div>
            {due > 0 && (
              <Button size="sm" variant="dark" onClick={onPay}>
                I paid
              </Button>
            )}
          </div>
        );
      })()}

      {fund.canManage && (
        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-5">
          <p className="font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            {owing.length === 0 ? "Everyone has paid in" : `Still to collect: ${rupees(owing.reduce((s, m) => s + m.pendingPaise, 0))}`}
          </p>
          {owing.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {owing.map((m) => (
                <li key={m.userId} className="text-sm rounded-full bg-card border border-card-border px-3 py-1">
                  {m.name} <span className="font-semibold">{rupees(m.pendingPaise)}</span>
                  {m.awaitingPaise > 0 && <span className="text-foreground/50"> ({rupees(m.awaitingPaise)} waiting)</span>}
                </li>
              ))}
            </ul>
          )}
          {me && collectorIsMe && me.pendingPaise > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-sm flex-1 min-w-48">
                Your own share ({rupees(me.pendingPaise)}) isn&apos;t recorded yet - you hold the cash, so record it yourself.
              </p>
              <Button size="sm" variant="outline" onClick={onPay}>
                Record my share
              </Button>
            </div>
          )}
          {toConfirm > 0 && (
            <p className="text-sm text-primary mt-2">
              {toConfirm} {toConfirm === 1 ? "payment needs" : "payments need"} your confirmation - see History below.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
