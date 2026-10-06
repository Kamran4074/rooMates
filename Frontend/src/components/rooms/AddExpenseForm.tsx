"use client";

import { useState } from "react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import type { Member } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Avatar } from "@/components/ui/Avatar";

// Today in India, as YYYY-MM-DD (the API uses Indian calendar days).
const todayInIndia = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export function AddExpenseForm({ roomId, members, onAdded }: { roomId: string; members: Member[]; onAdded: () => void }) {
  const myId = useAuthStore((s) => s.user?.id);
  const [paidBy, setPaidBy] = useState(myId ?? members[0]?.user_id ?? "");
  const [expenseDate, setExpenseDate] = useState(todayInIndia);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const customTotal = Object.values(customSplits).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const customMismatch = splitType === "custom" && Math.abs(customTotal - amountNum) > 0.01;
  const perHead = members.length ? amountNum / members.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiAuthPost(`/api/rooms/${roomId}/expenses`, {
        description,
        amount: amountNum,
        paidBy,
        expenseDate,
        splitType,
        ...(splitType === "custom" && {
          splits: members.map((m) => ({ userId: m.user_id, amount: parseFloat(customSplits[m.user_id] || "0") })),
        }),
      });
      onAdded();
    } catch (err) {
      setError(errorMessage(err, "Failed to add expense"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Description" required maxLength={200} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Groceries, Wi-Fi bill" />
      <TextField label="Amount (₹)" required type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select label="Paid by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)}>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {m.user_id === myId ? `${m.name} (you)` : m.name}
            </option>
          ))}
        </Select>
        <TextField label="Date" type="date" required max={todayInIndia()} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
      </div>

      <SegmentedControl
        value={splitType}
        onChange={setSplitType}
        options={[
          { value: "equal", label: "Split equally" },
          { value: "custom", label: "Custom split" },
        ]}
      />

      {splitType === "equal" ? (
        <p className="text-sm text-foreground/55">
          {members.length} {members.length === 1 ? "person" : "people"} · about ₹{perHead.toFixed(2)} each
        </p>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-card-border p-3">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2">
              <Avatar name={m.name} picture={m.picture} size={24} />
              <span className="text-sm flex-1 truncate">{m.name}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                aria-label={`${m.name}'s share`}
                value={customSplits[m.user_id] ?? ""}
                onChange={(e) => setCustomSplits((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                className="w-24 px-2 py-1.5 rounded-lg border border-card-border bg-background text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
          <p className={`text-xs pt-1 ${customMismatch ? "text-danger" : "text-success"}`}>
            Total: ₹{customTotal.toFixed(2)} of ₹{amountNum.toFixed(2)}
          </p>
        </div>
      )}

      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting} disabled={customMismatch}>
        {submitting ? "Adding..." : "Add expense"}
      </Button>
    </form>
  );
}
