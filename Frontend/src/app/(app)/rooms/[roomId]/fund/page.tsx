"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, Hourglass, Lock, PiggyBank, Plus, Wallet, HandCoins } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { rupees } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Fund, FundDetail, FundEntry, Member, Room } from "@/lib/types";
import { confirmFundEntry, deleteFundEntry } from "@/services/fundsApi";
import { useAuthStore } from "@/store/authStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { FormMessage } from "@/components/ui/FormMessage";
import { CreateFundForm } from "@/components/funds/CreateFundForm";
import { RecordPaymentForm } from "@/components/funds/RecordPaymentForm";
import { SpendFromFundForm } from "@/components/funds/SpendFromFundForm";
import { FundMembersCard } from "@/components/funds/FundMembersCard";
import { FundHistory } from "@/components/funds/FundHistory";
import { FundSettlementCard } from "@/components/funds/FundSettlementCard";
import { CloseFundPreview } from "@/components/funds/CloseFundPreview";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/Skeleton";

type ModalState = { kind: "create" } | { kind: "pay"; memberId?: string } | { kind: "spend" } | { kind: "close" } | null;

// Room fund: everyone pays a fixed amount to one collector upfront, it's spent
// on shared things, and closing it settles the leftover fairly.
export default function RoomFundPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const user = useAuthStore((s) => s.user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();

  const roomQuery = useApiQuery<Room>(`/api/rooms/${roomId}`);
  const membersQuery = useApiQuery<Member[]>(`/api/rooms/${roomId}/members`);
  const fundsQuery = useApiQuery<Fund[]>(`/api/rooms/${roomId}/funds`);
  const funds = fundsQuery.data ?? [];
  // Newest fund unless the user picked another one.
  const activeId = selectedId ?? funds[0]?.id ?? null;
  const detailQuery = useApiQuery<FundDetail>(activeId ? `/api/rooms/${roomId}/funds/${activeId}` : null);
  const fund = detailQuery.data;

  function refresh() {
    setModal(null);
    setActionError(null);
    fundsQuery.reload();
    detailQuery.reload();
  }

  async function run(action: () => Promise<unknown>, failure: string) {
    setActionError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setActionError(errorMessage(err, failure));
    }
  }

  const confirmEntry = (entry: FundEntry) =>
    fund && run(() => confirmFundEntry(roomId, fund.id, entry.id), "Couldn't confirm that");

  async function deleteEntry(entry: FundEntry, isReject: boolean) {
    if (!fund) return;
    const ok = await confirm(
      isReject
        ? {
            title: `Reject ${entry.member_name ?? "this"}'s payment?`,
            message: "Only do this if you didn't receive the money. It will be removed from the fund.",
            confirmLabel: "Reject payment",
            danger: true,
          }
        : { title: "Delete this entry?", confirmLabel: "Delete", danger: true }
    );
    if (!ok) return;
    run(() => deleteFundEntry(roomId, fund.id, entry.id), "Couldn't delete that entry");
  }

  const error = roomQuery.error ?? membersQuery.error ?? fundsQuery.error ?? detailQuery.error;
  if (error) return <p className="text-danger">{error}</p>;
  if (!roomQuery.data || fundsQuery.loading || (activeId && !fund)) {
    return <LoadingState variant="page" />;
  }
  const room = roomQuery.data;
  const open = fund?.status === "open";
  const isParticipant = !!fund?.members.some((m) => m.userId === user?.id);
  const unsettledPaise = (fund?.entries ?? [])
    .filter((e) => (e.kind === "refund" || e.kind === "collection") && !e.confirmed)
    .reduce((sum, e) => sum + e.amount_paise, 0);

  return (
    <>
      <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> {room.name}
      </Link>

      <PageHeader
        title="Room fund"
        subtitle="Everyone pays upfront, it's spent on shared things, and what's left is settled fairly at the end."
        actions={
          fund && (
            <>
              <Button variant="outline" size="sm" onClick={() => setModal({ kind: "create" })}>
                <Plus className="h-4 w-4" /> New fund
              </Button>
              {open && (fund.canManage || isParticipant) && (
                <Button variant="outline" size="sm" onClick={() => setModal({ kind: "pay", memberId: user?.id })}>
                  <ArrowDownLeft className="h-4 w-4" /> {fund.canManage ? "Record payment" : "I paid"}
                </Button>
              )}
              {open && (
                <Button variant="dark" size="sm" onClick={() => setModal({ kind: "spend" })} disabled={fund.balancePaise <= 0}>
                  <ArrowUpRight className="h-4 w-4" /> Spend
                </Button>
              )}
              {open && fund.canManage && (
                <Button variant="ghost" size="sm" onClick={() => setModal({ kind: "close" })}>
                  <Lock className="h-4 w-4" /> Close fund
                </Button>
              )}
            </>
          )
        }
      />

      {!fund ? (
        <Card className="rounded-3xl p-10 text-center">
          <PiggyBank className="h-10 w-10 mx-auto text-primary mb-4" />
          <h2 className="text-lg font-semibold mb-1">No fund yet</h2>
          <p className="text-foreground/55 max-w-sm mx-auto mb-6">
            Collect a fixed amount from everyone - say ₹1500 each - into one person&apos;s hands. Track who has paid, what it was
            spent on, and settle what&apos;s left at the end.
          </p>
          <Button variant="dark" onClick={() => setModal({ kind: "create" })}>
            <Plus className="h-4 w-4" /> Start a fund
          </Button>
        </Card>
      ) : (
        <>
          {funds.length > 1 && (
            <div className="max-w-xs mb-6">
              <Select aria-label="Choose fund" value={fund.id} onChange={(e) => setSelectedId(e.target.value)}>
                {funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                    {f.status === "closed" ? " (closed)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <Card className="rounded-3xl p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h2 className="font-semibold">{fund.name}</h2>
              <Badge tone={open ? "success" : "neutral"}>{open ? "Open" : "Closed"}</Badge>
            </div>
            <p className="text-sm text-foreground/55 mb-4">
              {rupees(fund.perMemberPaise)} per person · collected by{" "}
              <span className="font-medium text-foreground">{fund.collector.id === user?.id ? "you" : fund.collector.name}</span>
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                icon={<HandCoins className="h-4 w-4" />}
                label="Collected"
                value={rupees(fund.collectedPaise)}
                tone="primary"
                hint={
                  fund.awaitingConfirmationPaise > 0
                    ? `+ ${rupees(fund.awaitingConfirmationPaise)} waiting`
                    : `of ${rupees(fund.expectedPaise)}`
                }
              />
              <StatCard icon={<ArrowUpRight className="h-4 w-4" />} label="Spent" value={rupees(fund.spentPaise)} tone="accent" />
              <StatCard icon={<Wallet className="h-4 w-4" />} label={open ? "In hand" : "Left at close"} value={rupees(fund.balancePaise)} tone="success" />
              {open ? (
                <StatCard icon={<Hourglass className="h-4 w-4" />} label="Still to collect" value={rupees(fund.pendingPaise)} tone="danger" />
              ) : (
                // After closing, what's left is the settlement, not each person's original target.
                <StatCard icon={<Hourglass className="h-4 w-4" />} label="Still to settle" value={rupees(unsettledPaise)} tone="danger" />
              )}
            </div>
          </Card>

          <FormMessage error={actionError} />

          {!open && <FundSettlementCard fund={fund} currentUserId={user?.id} onDone={confirmEntry} />}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mt-2">
            <div className="lg:col-span-3">
              <FundMembersCard fund={fund} currentUserId={user?.id} onRecord={(memberId) => setModal({ kind: "pay", memberId })} />
            </div>
            <div className="lg:col-span-2">
              <FundHistory fund={fund} currentUserId={user?.id} onConfirm={confirmEntry} onDelete={deleteEntry} />
            </div>
          </div>
        </>
      )}

      <Modal open={modal?.kind === "create"} onClose={() => setModal(null)} title="Start a fund">
        <CreateFundForm
          key={membersQuery.data?.length ?? 0}
          roomId={roomId}
          members={membersQuery.data ?? []}
          onCreated={(id) => {
            setSelectedId(id);
            refresh();
          }}
        />
      </Modal>
      {fund && (
        <>
          <Modal open={modal?.kind === "pay"} onClose={() => setModal(null)} title={fund.canManage ? "Record a payment" : "I paid"}>
            <RecordPaymentForm
              key={modal?.kind === "pay" ? (modal.memberId ?? "any") : "closed"}
              roomId={roomId}
              fundId={fund.id}
              members={fund.members.filter((m) => fund.canManage || m.userId === user?.id)}
              initialMemberId={modal?.kind === "pay" ? modal.memberId : undefined}
              collectorName={fund.canManage ? undefined : fund.collector.name}
              onDone={refresh}
            />
          </Modal>
          <Modal open={modal?.kind === "spend"} onClose={() => setModal(null)} title="Spend from the fund">
            <SpendFromFundForm roomId={roomId} fundId={fund.id} balancePaise={fund.balancePaise} onDone={refresh} />
          </Modal>
          <Modal open={modal?.kind === "close"} onClose={() => setModal(null)} title={`Close ${fund.name}`}>
            {modal?.kind === "close" && (
              <CloseFundPreview roomId={roomId} fundId={fund.id} collectorName={fund.collector.name} onClosed={refresh} />
            )}
          </Modal>
        </>
      )}
    </>
  );
}
