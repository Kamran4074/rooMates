"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import type { Member } from "@/lib/types";
import { createFund } from "@/services/fundsApi";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

// e.g. "October 2026 fund" - most rooms collect once a month.
const defaultName = () =>
  `${new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })} fund`;

// Who's in the fund is fixed here (default: everyone), so someone joining the
// room later isn't asked for money. The collector holds the cash.
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
  const [participantIds, setParticipantIds] = useState(() => members.map((m) => m.user_id));
  const [collectorId, setCollectorId] = useState(roomAdmin?.user_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const perMember = parseFloat(amount) || 0;
  const people = members.filter((m) => participantIds.includes(m.user_id));

  function toggle(id: string) {
    const next = participantIds.includes(id) ? participantIds.filter((x) => x !== id) : [...participantIds, id];
    setParticipantIds(next);
    // The collector has to be in the fund.
    if (!next.includes(collectorId)) setCollectorId(next[0] ?? "");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const fund = await createFund(roomId, { name, amountPerMember: perMember, participantIds, collectorId });
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

      <div>
        <p className="text-sm font-medium mb-2">Who&apos;s in?</p>
        <ul className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
          {members.map((m) => {
            const on = participantIds.includes(m.user_id);
            return (
              <li key={m.user_id}>
                <button
                  type="button"
                  onClick={() => toggle(m.user_id)}
                  aria-pressed={on}
                  className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm ${
                    on ? "border-primary bg-primary/5" : "border-card-border opacity-60"
                  }`}
                >
                  <Avatar name={m.name} picture={m.picture} size={24} />
                  <span className="flex-1 truncate">{m.name}</span>
                  {on && <Check className="h-4 w-4 text-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <Select label="Who collects the money?" value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
        {people.map((m) => (
          <option key={m.user_id} value={m.user_id}>
            {m.name}
          </option>
        ))}
      </Select>

      {perMember > 0 && people.length > 0 && (
        <p className="text-sm text-foreground/55">
          {people.length} {people.length === 1 ? "person" : "people"} · {rupees(perMember * 100 * people.length)} to collect in total
        </p>
      )}
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting} disabled={people.length === 0}>
        {submitting ? "Creating..." : "Start fund"}
      </Button>
    </form>
  );
}
