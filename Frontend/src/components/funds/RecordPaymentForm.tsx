"use client";

import { useState } from "react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { FundMember } from "@/lib/types";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

const toRupeeInput = (paise: number) => (paise > 0 ? String(paise / 100) : "");
// What's left to pay, not counting a payment already waiting for confirmation.
const stillDue = (m?: FundMember) => (m ? Math.max(m.pendingPaise - m.awaitingPaise, 0) : 0);

// Records money a roommate handed over. Paying part now and the rest later is
// just two of these - the amount defaults to whatever that person still owes.
export function RecordPaymentForm({
  roomId,
  fundId,
  members,
  initialMemberId,
  collectorName,
  onDone,
}: {
  roomId: string;
  fundId: string;
  members: FundMember[];
  initialMemberId?: string;
  /** Set when the person recording isn't the collector: their payment waits for confirmation. */
  collectorName?: string;
  onDone: () => void;
}) {
  const startMember = members.find((m) => m.userId === initialMemberId) ?? members.find((m) => m.pendingPaise > 0) ?? members[0];
  const [memberId, setMemberId] = useState(startMember?.userId ?? "");
  const [amount, setAmount] = useState(toRupeeInput(stillDue(startMember)));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function selectMember(id: string) {
    setMemberId(id);
    setAmount(toRupeeInput(stillDue(members.find((m) => m.userId === id))));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiAuthPost(`/api/rooms/${roomId}/funds/${fundId}/contributions`, {
        memberId,
        amount: parseFloat(amount),
        ...(note.trim() && { note: note.trim() }),
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't record the payment"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {members.length > 1 ? (
        <Select label="Who paid?" value={memberId} onChange={(e) => selectMember(e.target.value)}>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name} {m.pendingPaise > 0 ? `· ${rupees(m.pendingPaise)} pending` : "· paid"}
            </option>
          ))}
        </Select>
      ) : (
        startMember && (
          <p className="text-sm text-foreground/60">
            {startMember.pendingPaise > 0 ? `You have ${rupees(startMember.pendingPaise)} pending.` : "You've paid your share."}
          </p>
        )
      )}
      <TextField
        label="Amount (₹)"
        required
        type="number"
        step="0.01"
        min="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <TextField
        label="Note (optional)"
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. UPI, rest after salary"
      />
      {collectorName && (
        <p className="text-xs text-foreground/55 rounded-xl bg-accent/10 px-3 py-2">
          {collectorName} will confirm once they&apos;ve received it. Until then it shows as waiting.
        </p>
      )}
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting}>
        {submitting ? "Saving..." : "Record payment"}
      </Button>
    </form>
  );
}
