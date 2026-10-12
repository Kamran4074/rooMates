"use client";

import { useState } from "react";
import { PhoneCall } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { priceLabel } from "@/lib/plans";
import type { BillingCycle, PaidPlanId, PlanInfo, UpgradeRequest } from "@/lib/types";
import { requestUpgrade } from "@/services/plansApi";
import { PhoneField } from "@/components/ui/PhoneField";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { BillingToggle } from "./BillingToggle";

// Asking for a paid plan. There's no online payment yet: the team calls this
// number, takes the payment (UPI, bank transfer...) and switches the plan on.
export function UpgradeRequestForm({
  plan,
  initialCycle,
  defaultPhone,
  onSent,
}: {
  plan: PlanInfo;
  initialCycle: BillingCycle;
  defaultPhone: string;
  onSent: (request: UpgradeRequest) => void;
}) {
  const [cycle, setCycle] = useState(initialCycle);
  const [phone, setPhone] = useState(defaultPhone);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      onSent(await requestUpgrade({ plan: plan.id as PaidPlanId, billingCycle: cycle, phone, note: note.trim() || undefined }));
    } catch (err) {
      setError(errorMessage(err, "Couldn't send the request"));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <BillingToggle value={cycle} onChange={setCycle} />
      <div className="rounded-2xl bg-foreground/4 px-4 py-3 text-sm">
        <span className="font-semibold">{plan.name}</span> · {priceLabel(plan, cycle)} for {cycle === "monthly" ? "1 month" : "1 year"}
      </div>
      <PhoneField
        label="Mobile number to call"
        value={phone}
        onChange={setPhone}
        hint="We'll call you to take the payment (UPI or bank transfer). Your plan starts as soon as it's confirmed."
      />
      <TextArea label="Anything we should know? (optional)" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. best time to call" />
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={sending} disabled={phone.length !== 10}>
        <PhoneCall className="h-4 w-4" /> {sending ? "Sending..." : "Request a call back"}
      </Button>
    </form>
  );
}
