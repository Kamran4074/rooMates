"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { Member } from "@/lib/types";
import { createFund } from "@/services/fundsApi";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

// e.g. "October 2026 fund" - most rooms collect once a month.
const defaultName = () =>
  `${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })} fund`;

// A fund applies to everyone in the room when it's started - nobody can be
// left out of the per-person amount. (Someone joining later isn't asked for
// money for it.) The collector holds the cash.
export function CreateFundForm({
  roomId,
  members,
  onCreated,
}: {
  roomId: string;
  members: Member[];
  onCreated: (fundId: string) => void;
}) {
  const roomAdmin = members.find((m) => m.role === "admin") ?? members[0];
  const [name, setName] = useState(defaultName);
  const [amount, setAmount] = useState("");
  const [collectorId, setCollectorId] = useState(roomAdmin?.user_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const perMember = parseFloat(amount) || 0;
  const people = members;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fund = await createFund(roomId, { name, amountPerMember: perMember, collectorId });
      onCreated(fund.id);
    } catch (err) {
      setError(errorMessage(err, "Couldn't create the fund"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Fund name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <TextField
        label="Amount per person (₹)"
        required
        type="number"
        step="0.01"
        min="1"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g. 1500"
      />

      <Select label="Who collects the money?" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
        {people.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.name}
          </option>
        ))}
      </Select>

      <p className="text-sm text-foreground/60 rounded-xl bg-primary/5 px-3 py-2">
        Applies to all {people.length} {people.length === 1 ? "member" : "members"} of the room
        {perMember > 0 && <> · {rupees(perMember * 100 * people.length)} to collect in total</>}. Payments count once
        both sides agree.
      </p>
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting} disabled={people.length === 0}>
        {submitting ? "Creating..." : "Start fund"}
      </Button>
    </form>
  );
}
