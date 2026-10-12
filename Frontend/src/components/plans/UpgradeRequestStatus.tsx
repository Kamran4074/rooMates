"use client";

import { useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatDate, rupees } from "@/lib/format";
import { PLAN_NAMES } from "@/lib/plans";
import type { UpgradeRequest } from "@/lib/types";
import { cancelUpgradeRequest } from "@/services/plansApi";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

const RECENT_MS = 14 * 24 * 60 * 60 * 1000;

// Where my latest upgrade request stands. Decided ones show for two weeks,
// so "declined: couldn't reach you" isn't missed; cancelled ones not at all.
export function UpgradeRequestStatus({ request, onChanged }: { request: UpgradeRequest | null; onChanged: () => void }) {
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read the clock once (render must be pure); a page visit is short.
  const [now] = useState(() => Date.now());
  if (!request || request.status === "cancelled") return null;
  const recent = request.decided_at ? now - new Date(request.decided_at).getTime() < RECENT_MS : true;
  if (!recent) return null;

  const what = `${PLAN_NAMES[request.plan]} (${request.billing_cycle}, ${rupees(request.amount_paise)})`;

  async function cancel() {
    setError(null);
    setCancelling(true);
    try {
      await cancelUpgradeRequest(request!.id);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't cancel the request"));
    } finally {
      setCancelling(false);
    }
  }

  if (request.status === "pending") {
    return (
      <div className="rounded-3xl border border-accent/40 bg-accent/10 p-5 mb-6 flex flex-wrap items-center gap-4">
        <Clock className="h-5 w-5 text-accent shrink-0" />
        <div className="flex-1 min-w-56">
          <p className="font-medium">Your request for {what} is waiting</p>
          <p className="text-sm text-foreground/60">
            We&apos;ll call you on {request.phone} to take the payment. Sent {formatDate(request.created_at)}.
          </p>
          <FormMessage error={error} />
        </div>
        <Button size="sm" variant="outline" onClick={cancel} loading={cancelling}>
          Cancel request
        </Button>
      </div>
    );
  }

  const approved = request.status === "approved";
  return (
    <div className={`rounded-3xl border p-5 mb-6 flex items-start gap-4 ${approved ? "border-success/40 bg-success/10" : "border-danger/30 bg-danger/5"}`}>
      {approved ? <CheckCircle2 className="h-5 w-5 text-success shrink-0" /> : <XCircle className="h-5 w-5 text-danger shrink-0" />}
      <div>
        <p className="font-medium">{approved ? `${PLAN_NAMES[request.plan]} is active - thanks!` : `Your request for ${what} wasn't approved`}</p>
        {request.admin_note && <p className="text-sm text-foreground/60">{request.admin_note}</p>}
        {!approved && <p className="text-sm text-foreground/60">You can send a new request below.</p>}
      </div>
    </div>
  );
}
