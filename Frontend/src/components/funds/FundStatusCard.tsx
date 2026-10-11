"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, HandCoins, PiggyBank } from "lucide-react";
import { rupees } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import { useLiveRefresh } from "@/lib/live";
import type { FundStatus } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";

const first = (name: string) => name.split(" ")[0];

// Dashboard: every open fund in my rooms, in one sentence each - what I still
// owe and to whom, or (if I run it) who still owes me. Renders nothing when
// there are no open funds.
export function FundStatusCard() {
  const { data, reload } = useApiQuery<FundStatus[]>("/api/funds/summary");
  useLiveRefresh(reload);
  if (!data || data.length === 0) return null;

  return (
    <Card className="rounded-3xl p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-4">
        <PiggyBank className="h-4 w-4" /> Room funds
      </h2>
      <ul className="flex flex-col gap-4">
        {data.map((f) => (
          <li key={f.fundId} className="rounded-2xl bg-foreground/3 p-4">
            <Link href={`/rooms/${f.roomId}/fund`} className="flex items-center justify-between gap-2 mb-2 group">
              <span className="min-w-0">
                <span className="block font-medium truncate group-hover:text-primary">{f.fundName}</span>
                <span className="block text-xs text-foreground/50">
                  {f.roomName} · {rupees(f.perMemberPaise)} per person
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-foreground/35 shrink-0" />
            </Link>
            <ProgressBar value={f.collectedPaise} max={f.expectedPaise} />
            <p className="text-xs text-foreground/50 mt-1 mb-3">
              {rupees(f.collectedPaise)} of {rupees(f.expectedPaise)} collected
            </p>

            {/* Three states: still owe / recorded but not confirmed yet / paid. */}
            {f.me && !f.canManage && f.me.duePaise > 0 && (
              <p className="text-sm flex items-center gap-2 text-danger">
                <HandCoins className="h-4 w-4" /> You owe {rupees(f.me.duePaise)} - pay {first(f.collector.name)}
              </p>
            )}
            {f.me && f.me.awaitingPaise > 0 && (
              <p className="text-sm flex items-center gap-2 text-accent mt-1">
                <Clock className="h-4 w-4" /> {rupees(f.me.awaitingPaise)} of yours is recorded - waiting for confirmation
              </p>
            )}
            {f.me && !f.canManage && f.me.duePaise === 0 && f.me.awaitingPaise === 0 && (
              <p className="text-sm flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" /> You&apos;ve paid your share
              </p>
            )}
            {f.toApprove > 0 && (
              <Link href="/notifications" className="block text-sm text-primary font-medium mt-1">
                {f.toApprove} {f.toApprove === 1 ? "payment was" : "payments were"} recorded for you - approve
              </Link>
            )}
            {f.canManage && (
              <>
                <p className="text-sm">
                  {f.toCollect.length === 0
                    ? "Everyone has paid in"
                    : `To collect: ${f.toCollect.map((p) => `${first(p.name)} ${rupees(p.duePaise)}`).join(", ")}`}
                </p>
                {f.toConfirm > 0 && (
                  <Link href={`/rooms/${f.roomId}/fund`} className="block text-sm text-primary font-medium mt-1">
                    {f.toConfirm} {f.toConfirm === 1 ? "payment needs" : "payments need"} your confirmation
                  </Link>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
