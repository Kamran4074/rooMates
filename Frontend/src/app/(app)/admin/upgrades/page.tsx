"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, MessageCircle, Phone, Sparkles } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatDate, rupees, timeAgo } from "@/lib/format";
import { localDigits, PLAN_NAMES } from "@/lib/plans";
import { usePagedQuery } from "@/lib/useApiQuery";
import type { AdminUpgradeRequest } from "@/lib/types";
import { approveUpgrade, rejectUpgrade } from "@/services/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Pagination } from "@/components/ui/Pagination";
import { ReasonModal } from "@/components/ui/ReasonModal";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/Skeleton";

type Status = "pending" | "approved" | "rejected" | "cancelled";
const STATUS_TONE: Record<Status, BadgeTone> = { pending: "accent", approved: "success", rejected: "danger", cancelled: "neutral" };

// Plan requests: call the number, take the payment, then approve - the plan
// switches on at once, for the month or year they paid for.
export default function AdminUpgradesPage() {
  const [status, setStatus] = useState<Status>("pending");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState<AdminUpgradeRequest | null>(null);
  const confirm = useConfirm();
  const { data, error: loadError, reload } = usePagedQuery<AdminUpgradeRequest>(`/api/admin/upgrade-requests?status=${status}&page=${page}&limit=20`);

  async function approve(r: AdminUpgradeRequest) {
    const ok = await confirm({
      title: `Payment received from ${r.name}?`,
      message: `${rupees(r.amount_paise)} for ${PLAN_NAMES[r.plan]} (${r.billing_cycle}). Their plan switches on now for ${r.billing_cycle === "monthly" ? "a month" : "a year"}.`,
      confirmLabel: "Yes, activate",
    });
    if (!ok) return;
    setError(null);
    try {
      await approveUpgrade(r.id);
      reload();
    } catch (err) {
      setError(errorMessage(err, "Couldn't activate the plan"));
    }
  }

  return (
    <>
      <PageHeader title="Upgrades" subtitle="Plan requests. Call, take the payment, then activate." />
      <div className="max-w-xl mb-6">
        <SegmentedControl
          value={status}
          onChange={(s) => {
            setStatus(s);
            setPage(1);
          }}
          options={[
            { value: "pending", label: "Waiting" },
            { value: "approved", label: "Activated" },
            { value: "rejected", label: "Declined" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </div>
      <FormMessage error={error} />

      {loadError ? (
        <p className="text-danger">{loadError}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title={status === "pending" ? "No requests waiting" : "Nothing here"} />
      ) : (
        <Card className="rounded-3xl px-4 sm:px-6 py-2">
          <ul className="divide-y divide-card-border">
            {data.items.map((r) => {
              const digits = localDigits(r.phone);
              return (
                <li key={r.id} className="py-4 flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={r.name} picture={r.picture} size={36} />
                    <div className="flex-1 min-w-48">
                      <Link href={`/admin/users/${r.user_id}`} className="font-medium hover:text-primary">
                        {r.name}
                      </Link>
                      <p className="text-xs text-foreground/50 truncate">{r.email}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Badge>{PLAN_NAMES[r.current_plan]}</Badge>
                      <ArrowRight className="h-4 w-4 text-foreground/40" />
                      <Badge tone="primary">{PLAN_NAMES[r.plan]}</Badge>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{rupees(r.amount_paise)}</p>
                      <p className="text-xs text-foreground/50">{r.billing_cycle}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <a href={`tel:+91${digits}`} className="inline-flex items-center gap-1.5 rounded-full border border-card-border px-3 py-1.5 hover:bg-foreground/5">
                      <Phone className="h-3.5 w-3.5" /> +91 {digits}
                    </a>
                    <a
                      href={`https://wa.me/91${digits}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full border border-card-border px-3 py-1.5 hover:bg-foreground/5"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                    </a>
                    <span className="text-xs text-foreground/50">Asked {timeAgo(r.created_at)}</span>
                  </div>
                  {r.note && <p className="text-sm text-foreground/75">&ldquo;{r.note}&rdquo;</p>}

                  {r.status === "pending" ? (
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="dark" onClick={() => approve(r)}>
                        Payment received - activate
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeclining(r)}>
                        Decline
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-foreground/55 flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                      {r.decided_at && `${formatDate(r.decided_at, "short")}`}
                      {r.decided_by_name && ` by ${r.decided_by_name}`}
                      {r.admin_note && ` · ${r.admin_note}`}
                      {r.status === "approved" && r.plan_expires_at && ` · runs until ${formatDate(r.plan_expires_at)}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}

      <ReasonModal
        open={declining !== null}
        title={declining ? `Decline ${declining.name}'s request?` : ""}
        label="Message for them (optional)"
        confirmLabel="Decline"
        required={false}
        description="They'll see this on their Plans page and can send a new request."
        onClose={() => setDeclining(null)}
        onConfirm={async (note) => {
          await rejectUpgrade(declining!.id, note || undefined);
          setDeclining(null);
          reload();
        }}
      />
    </>
  );
}
