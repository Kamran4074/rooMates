"use client";

import { useState } from "react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import { todayInIndia } from "@/lib/format";
import type { Member } from "@/lib/types";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export interface PaymentDraft {
  fromUserId: string;
  toUserId: string;
  amountPaise?: number;
}

// "Aman paid Chirag ₹285". Opened pre-filled from a suggested settle-up row,
// or blank from "Record a payment". The API only lets one of the two people
// (or the room admin) save it, and says so if someone else tries.
export function SettlePaymentForm({
  roomId,
  members,
  myId,
  initial,
  onSaved,
}: {
  roomId: string;
  members: Member[];
  myId?: string;
  initial: PaymentDraft;
  onSaved: () => void;
}) {
  const [fromUserId, setFromUserId] = useState(initial.fromUserId);
  const [toUserId, setToUserId] = useState(initial.toUserId);
  const [amount, setAmount] = useState(initial.amountPaise ? (initial.amountPaise / 100).toFixed(2) : "");
  const [settledOn, setSettledOn] = useState(todayInIndia);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const label = (m: Member) => (m.user_id === myId ? `${m.name} (you)` : m.name);
  const samePerson = fromUserId === toUserId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await apiAuthPost(`/api/rooms/${roomId}/settlements`, {
        fromUserId,
        toUserId,
        amount: parseFloat(amount),
        settledOn,
        ...(note.trim() && { note: note.trim() }),
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Couldn't record the payment"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Who paid" value={fromUserId} onChange={(e) => setFromUserId(e.target.value)}>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {label(m)}
            </option>
          ))}
        </Select>
        <Select label="Paid to" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {label(m)}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField
          label="Amount (₹)"
          required
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <TextField label="Date" type="date" required max={todayInIndia()} value={settledOn} onChange={(e) => setSettledOn(e.target.value)} />
      </div>

      <TextField label="Note" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. UPI, cash" />

      {samePerson && <p className="text-sm text-danger">Pick two different people.</p>}
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={saving} disabled={samePerson}>
        {saving ? "Saving..." : "Record payment"}
      </Button>
    </form>
  );
}
