"use client";

import { useState } from "react";
import { ArrowRight, Check, HandCoins, Scale, Trash2 } from "lucide-react";
import { apiAuthDelete, errorMessage } from "@/lib/api";
import { rupees, formatDate } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import type { Member, Payment, Settlement } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { FormMessage } from "@/components/ui/FormMessage";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { PaymentDraft, SettlePaymentForm } from "./SettlePaymentForm";

const RECENT = 5;

// The suggested plan (fewest payments) plus the payments already recorded.
// Marking a suggestion paid records it; balances and the plan then shrink.
// Who may record or delete: one of the two people involved, or the room admin
// (the API enforces it; the buttons just don't show for anyone else).
export function SettleUpCard({
  roomId,
  members,
  myId,
  isAdmin,
  plan,
  onChanged,
}: {
  roomId: string;
  members: Member[];
  myId?: string;
  isAdmin: boolean;
  plan: Settlement[];
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<PaymentDraft | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const history = usePagedQuery<Payment>(`/api/rooms/${roomId}/settlements?limit=${RECENT}`, version);
  const payments = history.data?.items ?? [];
  const totalPayments = history.data?.pagination.total ?? 0;

  const you = (id: string, name?: string) => (id === myId ? "You" : name);
  const canRecord = (from: string, to: string) => isAdmin || from === myId || to === myId;

  function saved() {
    setDraft(null);
    setVersion((v) => v + 1);
    onChanged();
  }

  async function remove(p: Payment) {
    const ok = await confirm({
      title: "Delete this payment?",
      message: `${p.from_name} → ${p.to_name}, ${rupees(p.amount_paise)}. The amount goes back into the balances.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await apiAuthDelete(`/api/rooms/${roomId}/settlements/${p.id}`);
      saved();
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete the payment"));
    }
  }

  // "Record a payment" starts from me paying the first other member.
  const blankDraft = (): PaymentDraft => {
    const other = members.find((m) => m.user_id !== myId);
    return { fromUserId: myId ?? members[0]?.user_id ?? "", toUserId: other?.user_id ?? "" };
  };

  return (
    <Card className="rounded-3xl p-6">
      <h2 className="font-semibold flex items-center gap-2 mb-1">
        <Scale className="h-4 w-4" /> Settle up
      </h2>
      <p className="text-xs text-foreground/50 mb-4">The fewest payments that square everyone up.</p>

      {plan.length === 0 ? (
        <p className="text-sm text-foreground/55">Everyone&apos;s settled up.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {plan.map((s) => (
            <li key={`${s.fromUserId}-${s.toUserId}`} className="flex flex-wrap items-center gap-2 text-sm rounded-2xl bg-foreground/3 px-3 py-2.5">
              <span className="font-medium truncate">{you(s.fromUserId, s.fromName)}</span>
              <ArrowRight className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
              <span className="font-medium truncate">{you(s.toUserId, s.toName)}</span>
              <span className="ml-auto font-semibold text-primary">{rupees(s.amountPaise)}</span>
              {canRecord(s.fromUserId, s.toUserId) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="basis-full"
                  onClick={() => setDraft({ fromUserId: s.fromUserId, toUserId: s.toUserId, amountPaise: s.amountPaise })}
                >
                  <Check className="h-4 w-4" /> Mark as paid
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {members.length > 1 && (
        <button onClick={() => setDraft(blankDraft())} className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary font-medium">
          <HandCoins className="h-4 w-4" /> Record a payment
        </button>
      )}

      {payments.length > 0 && (
        <div className="mt-5 pt-4 border-t border-card-border">
          <p className="text-xs uppercase tracking-wider font-semibold text-foreground/45 mb-2">Recorded payments</p>
          <ul className="flex flex-col gap-2">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-foreground/45 w-12 shrink-0">{formatDate(p.settled_on, "short")}</span>
                <span className="min-w-0 flex-1 truncate">
                  {you(p.from_user_id, p.from_name)} → {you(p.to_user_id, p.to_name)}
                  {p.note && <span className="text-foreground/45"> · {p.note}</span>}
                </span>
                <span className="font-semibold">{rupees(p.amount_paise)}</span>
                {(isAdmin || p.created_by === myId) && (
                  <button
                    onClick={() => remove(p)}
                    className="p-1.5 rounded-full text-foreground/35 hover:text-danger hover:bg-danger/10"
                    aria-label={`Delete payment ${p.from_name} to ${p.to_name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {totalPayments > RECENT && <p className="text-xs text-foreground/45 mt-2">Latest {RECENT} of {totalPayments}.</p>}
        </div>
      )}
      <div className="mt-3">
        <FormMessage error={error ?? history.error} />
      </div>

      <Modal open={draft !== null} onClose={() => setDraft(null)} title="Record a payment">
        {draft && <SettlePaymentForm roomId={roomId} members={members} myId={myId} initial={draft} onSaved={saved} />}
      </Modal>
    </Card>
  );
}
