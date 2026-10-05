"use client";

import { useState } from "react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export function SpendFromFundForm({
  roomId,
  fundId,
  balancePaise,
  onDone,
}: {
  roomId: string;
  fundId: string;
  balancePaise: number;
  onDone: () => void;
}) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const tooMuch = Math.round((parseFloat(amount) || 0) * 100) > balancePaise;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiAuthPost(`/api/rooms/${roomId}/funds/${fundId}/spends`, { description, amount: parseFloat(amount) });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Couldn't record the spend"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-foreground/55">
        Available in the fund: <span className="font-semibold text-foreground">{rupees(balancePaise)}</span>
      </p>
      <TextField
        label="What was it for?"
        required
        maxLength={200}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. Groceries, gas cylinder"
      />
      <TextField
        label="Amount (₹)"
        required
        type="number"
        step="0.01"
        min="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {/* The server enforces this too; this just says so before submitting. */}
      {tooMuch && <p className="text-danger text-sm">That&apos;s more than the fund has.</p>}
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting} disabled={tooMuch}>
        {submitting ? "Saving..." : "Spend from fund"}
      </Button>
    </form>
  );
}
