"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import type { FundClosePreview } from "@/lib/types";
import { closeFund } from "@/services/fundsApi";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

// Shown before closing: everyone's equal share of what was spent, and who
// gets money back or still owes. Nothing changes until "Close fund".
export function CloseFundPreview({
  roomId,
  fundId,
  collectorName,
  onClosed,
}: {
  roomId: string;
  fundId: string;
  collectorName: string;
  onClosed: () => void;
}) {
  const { data: preview, error: loadError } = useApiQuery<FundClosePreview>(`/api/rooms/${roomId}/funds/${fundId}/close-preview`);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleClose() {
    setBusy(true);
    setError(null);
    try {
      await closeFund(roomId, fundId);
      onClosed();
    } catch (err) {
      setError(errorMessage(err, "Couldn't close the fund"));
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <p className="text-danger text-sm">{loadError}</p>;
  if (!preview) return <p className="text-sm text-foreground/50">Working it out...</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/65">
        {rupees(preview.spentPaise)} was spent, so everyone&apos;s share is about{" "}
        <span className="font-semibold text-foreground">{rupees(preview.sharePerPersonPaise)}</span>. Whoever paid more gets the
        difference back from {collectorName}; whoever paid less pays it to {collectorName}.
      </p>

      <ul className="rounded-2xl border border-card-border divide-y divide-card-border text-sm">
        {preview.lines.map((l) => (
          <li key={l.userId} className="flex items-center gap-2 px-3 py-2">
            <span className="flex-1 truncate">
              {l.name}
              {l.isCollector && <span className="text-foreground/45"> (collector)</span>}
            </span>
            <span className="text-xs text-foreground/50 whitespace-nowrap">paid {rupees(l.paidPaise)}</span>
            <span
              className={`w-24 text-right font-medium whitespace-nowrap ${
                l.netPaise > 0 ? "text-success" : l.netPaise < 0 ? "text-danger" : "text-foreground/45"
              }`}
            >
              {l.netPaise === 0 ? "settled" : `${l.netPaise > 0 ? "+" : "−"}${rupees(l.netPaise)}`}
            </span>
          </li>
        ))}
      </ul>

      {preview.transfers.length > 0 ? (
        <div className="text-sm">
          <p className="font-medium mb-1">After closing</p>
          <ul className="flex flex-col gap-1 text-foreground/70">
            {preview.transfers.map((t) => (
              <li key={t.userId}>
                {t.kind === "refund" ? `${collectorName} gives ${t.name}` : `${t.name} gives ${collectorName}`}{" "}
                <span className="font-semibold text-foreground">{rupees(t.amountPaise)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-foreground/60">Nobody needs to pay anyone - it&apos;s already even.</p>
      )}

      {preview.unconfirmedPayments > 0 && (
        <p className="text-sm text-danger">Confirm or reject the payments still waiting before closing.</p>
      )}
      <p className="text-xs text-foreground/50">Once closed, no more payments or spends can be added.</p>
      <FormMessage error={error} />
      <Button variant="dark" onClick={handleClose} loading={busy} disabled={preview.unconfirmedPayments > 0}>
        Close fund
      </Button>
    </div>
  );
}
