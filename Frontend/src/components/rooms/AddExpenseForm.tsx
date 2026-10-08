"use client";

import { useState } from "react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import { rupees, todayInIndia } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Category, Member } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Avatar } from "@/components/ui/Avatar";
import { MemberPicker } from "./MemberPicker";

// Add an expense. Picking a bill section (Rent, Groceries...) ticks the people
// who share that bill; untick or tick anyone for this one expense. The amount
// is split equally between the ticked people - or type custom amounts.
export function AddExpenseForm({ roomId, members, onAdded }: { roomId: string; members: Member[]; onAdded: () => void }) {
  const myId = useAuthStore((s) => s.user?.id);
  const { data: categories = [] } = useApiQuery<Category[]>(`/api/rooms/${roomId}/categories`);
  const everyone = members.map((m) => m.user_id);

  const [categoryId, setCategoryId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>(everyone);
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
  const nobody = splitType === "equal" && participantIds.length === 0;
  const perHead = participantIds.length ? (amountNum * 100) / participantIds.length : 0;

  function chooseCategory(id: string) {
    setCategoryId(id);
    const category = categories.find((c) => c.id === id);
    // Only people still in the room (a section can't hold anyone else, but be safe).
    setParticipantIds(category ? category.member_ids.filter((m) => everyone.includes(m)) : everyone);
    if (category && !description) setDescription(category.name);
  }

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
        ...(categoryId && { categoryId }),
        ...(splitType === "equal"
          ? { participantIds }
          : { splits: members.map((m) => ({ userId: m.user_id, amount: parseFloat(customSplits[m.user_id] || "0") })) }),
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
      {categories.length > 0 && (
        <Select label="Section" value={categoryId} onChange={(e) => chooseCategory(e.target.value)}>
          <option value="">No section</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      )}
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
          { value: "custom", label: "Custom amounts" },
        ]}
      />

      {splitType === "equal" ? (
        <>
          <MemberPicker members={members} selected={participantIds} onChange={setParticipantIds} myId={myId} />
          <p className={`text-sm ${nobody ? "text-danger" : "text-foreground/55"}`}>
            {nobody
              ? "Pick at least one person."
              : `${participantIds.length} ${participantIds.length === 1 ? "person" : "people"} · about ${rupees(perHead)} each`}
          </p>
        </>
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
      <Button type="submit" variant="dark" loading={submitting} disabled={customMismatch || nobody}>
        {submitting ? "Adding..." : "Add expense"}
      </Button>
    </form>
  );
}
