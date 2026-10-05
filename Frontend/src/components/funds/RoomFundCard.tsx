import Link from "next/link";
import { ArrowRight, PiggyBank } from "lucide-react";
import { rupees } from "@/lib/format";
import type { Fund } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

// Room-page teaser for the newest fund. `undefined` = still loading (render
// nothing), `null` = the room has no fund yet.
export function RoomFundCard({ roomId, fund }: { roomId: string; fund: Fund | null | undefined }) {
  if (fund === undefined) return null;
  const href = `/rooms/${roomId}/fund`;

  return (
    <Card className="rounded-3xl p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <PiggyBank className="h-4 w-4" /> Room fund
      </h2>
      {fund === null ? (
        <>
          <p className="text-xs text-foreground/50 mb-4">Collect money upfront and track who has paid.</p>
          <Link href={href} className="text-sm text-primary font-medium inline-flex items-center gap-1">
            Start a fund <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      ) : (
        <>
          <p className="text-xs text-foreground/50 mb-4">
            {fund.name}
            {fund.status === "closed" && " · closed"}
          </p>
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-semibold">{rupees(fund.balancePaise)}</span>
            <span className="text-xs text-foreground/55">{fund.status === "closed" ? "left at close" : "in hand"}</span>
          </div>
          <ProgressBar value={fund.collectedPaise} max={fund.expectedPaise} />
          <p className="text-xs text-foreground/55 mt-2 mb-4">
            {rupees(fund.collectedPaise)} of {rupees(fund.expectedPaise)} collected
            {fund.status === "open" && fund.pendingPaise > 0 && <span className="text-danger"> · {rupees(fund.pendingPaise)} pending</span>}
            {fund.status === "open" && fund.awaitingConfirmationPaise > 0 && (
              <span className="text-accent"> · {rupees(fund.awaitingConfirmationPaise)} to confirm</span>
            )}
          </p>
          <Link href={href} className="text-sm text-primary font-medium inline-flex items-center gap-1">
            Open fund <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </>
      )}
    </Card>
  );
}
