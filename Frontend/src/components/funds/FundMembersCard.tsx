import { rupees } from "@/lib/format";
import type { FundDetail } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

// Each participant's progress towards their share. Only confirmed money fills
// the bar; money a member says they paid shows as "waiting" until confirmed.
export function FundMembersCard({
  fund,
  currentUserId,
  onRecord,
}: {
  fund: FundDetail;
  currentUserId?: string;
  onRecord: (memberId: string) => void;
}) {
  const open = fund.status === "open";
  return (
    <Card className="rounded-3xl p-6">
      <h2 className="font-semibold mb-4">Who has paid</h2>
      <ul className="flex flex-col gap-5">
        {fund.members.map((m) => {
          const canRecord = open && m.pendingPaise > m.awaitingPaise && (fund.canManage || m.userId === currentUserId);
          return (
            <li key={m.userId} className="flex items-start gap-3">
              <Avatar name={m.name} picture={m.picture} size={36} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5 min-h-8">
                  <span className="text-sm font-medium truncate">
                    {m.name}
                    {m.userId === currentUserId && <span className="text-foreground/45 font-normal"> (you)</span>}
                    {m.userId === fund.collector.id && <span className="ml-2 align-middle"><Badge tone="primary">Collector</Badge></span>}
                  </span>
                  {canRecord && (
                    <Button variant="outline" size="sm" className="h-8! px-3! text-xs shrink-0" onClick={() => onRecord(m.userId)}>
                      {m.userId === currentUserId && !fund.canManage ? "I paid" : "Record"}
                    </Button>
                  )}
                </div>
                <ProgressBar value={m.paidPaise} max={fund.perMemberPaise} />
                {/* Status and amounts on their own line so a narrow phone never squeezes the name. */}
                <div className="flex flex-wrap items-center justify-between gap-x-2 mt-1 text-xs">
                  {/* Once closed, the final settlement replaces "pending". */}
                  <span className={`whitespace-nowrap ${!open ? "text-foreground/55" : m.pendingPaise > 0 ? "text-danger" : "text-success"}`}>
                    {!open ? "Paid in" : m.pendingPaise > 0 ? `${rupees(m.pendingPaise)} pending` : "Paid in full"}
                  </span>
                  <span className="whitespace-nowrap text-foreground/55">
                    {rupees(m.paidPaise)} / {rupees(fund.perMemberPaise)}
                  </span>
                  {/* Its own item, so on a phone it wraps to a new line instead of overflowing. */}
                  {m.awaitingPaise > 0 && (
                    <span className="basis-full text-accent">{rupees(m.awaitingPaise)} waiting for confirmation</span>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
