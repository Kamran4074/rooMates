"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Plus, UserPlus, UserMinus, Receipt, Scale, Users as UsersIcon } from "lucide-react";
import { apiAuthDelete, errorMessage } from "@/lib/api";
import { FormMessage } from "@/components/ui/FormMessage";
import { rupees, formatDate } from "@/lib/format";
import { useApiQuery, usePagedQuery } from "@/lib/useApiQuery";
import type { RoomDetail, Member, Expense, RoomBalances, Fund } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { useRoomsStore } from "@/store/roomsStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { InviteShare } from "@/components/rooms/InviteShare";
import { AddExpenseForm } from "@/components/rooms/AddExpenseForm";
import { RoomFundCard } from "@/components/funds/RoomFundCard";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/Skeleton";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const user = useAuthStore((s) => s.user);
  const reloadRooms = useRoomsStore((s) => s.load);
  const [modal, setModal] = useState<"expense" | "invite" | null>(null);
  const [memberError, setMemberError] = useState<string | null>(null);
  const confirm = useConfirm();

  // Four independent requests, fired in parallel.
  const roomQuery = useApiQuery<RoomDetail>(`/api/rooms/${roomId}`);
  const membersQuery = useApiQuery<Member[]>(`/api/rooms/${roomId}/members`);
  const [expensePage, setExpensePage] = useState(1);
  const expensesQuery = usePagedQuery<Expense>(`/api/rooms/${roomId}/expenses?page=${expensePage}&limit=20`);
  const balancesQuery = useApiQuery<RoomBalances>(`/api/rooms/${roomId}/balances`);
  // Not part of the loading gate below - the fund card just appears when ready.
  const fundsQuery = useApiQuery<Fund[]>(`/api/rooms/${roomId}/funds`);
  const latestFund = fundsQuery.data ? (fundsQuery.data[0] ?? null) : undefined;

  const room = roomQuery.data;
  const members = membersQuery.data ?? [];
  const expenses = expensesQuery.data?.items ?? [];
  const balances = balancesQuery.data?.balances ?? [];
  const settlements = balancesQuery.data?.settlements ?? [];

  async function handleRemove(memberId: string, name: string) {
    const ok = await confirm({
      title: `Remove ${name}?`,
      message: "They lose access to this room. The invite code also changes, so they can't rejoin with the old one.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    setMemberError(null);
    try {
      await apiAuthDelete(`/api/rooms/${roomId}/members/${memberId}`);
      membersQuery.reload();
      balancesQuery.reload();
      roomQuery.reload(); // new invite code
    } catch (err) {
      setMemberError(errorMessage(err, "Couldn't remove them"));
    }
  }

  function onExpenseAdded() {
    setModal(null);
    // The new expense is the newest, i.e. on page 1.
    if (expensePage === 1) expensesQuery.reload();
    else setExpensePage(1);
    roomQuery.reload(); // totals
    balancesQuery.reload();
    reloadRooms(); // keeps the dashboard/sidebar balance for this room in sync
  }

  const error = roomQuery.error ?? membersQuery.error ?? expensesQuery.error ?? balancesQuery.error;
  if (error) return <p className="text-danger">{error}</p>;
  if (!room || !expensesQuery.data || membersQuery.loading || balancesQuery.loading) {
    return <LoadingState variant="page" />;
  }

  const isAdmin = room.my_role === "admin";
  const myNet = balances.find((b) => b.userId === user?.id)?.netPaise ?? 0;
  const total = room.total_spent_paise;

  return (
    <>
      <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> All rooms
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <RoomIcon type={room.type} /> {room.name}
          </span>
        }
        subtitle={`${room.type === "trip" ? "Trip" : "Flat"} · ${members.length} ${members.length === 1 ? "member" : "members"}`}
        actions={
          <>
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => setModal("invite")}>
                <UserPlus className="h-4 w-4" /> Invite
              </Button>
            )}
            <Button variant="dark" size="sm" onClick={() => setModal("expense")}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <Card
          className={`p-6 rounded-3xl ${myNet > 0 ? "bg-success/10 border-success/30" : myNet < 0 ? "bg-danger/10 border-danger/30" : ""}`}
        >
          <p className="text-sm text-foreground/60 mb-1">Your balance</p>
          <p className={`text-3xl font-semibold ${myNet > 0 ? "text-success" : myNet < 0 ? "text-danger" : ""}`}>
            {myNet === 0 ? "All settled" : rupees(myNet)}
          </p>
          <p className="text-sm text-foreground/60 mt-1">{myNet > 0 ? "Others owe you" : myNet < 0 ? "You owe others" : "Nothing to pay or collect"}</p>
        </Card>
        <Card className="p-6 rounded-3xl">
          <p className="text-sm text-foreground/60 mb-1">Total spent in this room</p>
          <p className="text-3xl font-semibold">{rupees(total)}</p>
          <p className="text-sm text-foreground/60 mt-1">
            across {room.expense_count} {room.expense_count === 1 ? "expense" : "expenses"}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl p-6">
          <h2 className="font-semibold flex items-center gap-2 mb-4">
            <Receipt className="h-4 w-4" /> Expenses
          </h2>
          {expenses.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-foreground/50 mb-4">No expenses yet.</p>
              <Button variant="dark" size="sm" onClick={() => setModal("expense")}>
                <Plus className="h-4 w-4" /> Add the first one
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-card-border">
              {expenses.map((exp) => (
                <li key={exp.id} className="flex items-center gap-4 py-3">
                  <span className="text-xs text-foreground/45 w-12 shrink-0">{formatDate(exp.expense_date, "short")}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{exp.description}</p>
                    <p className="text-xs text-foreground/50">Paid by {exp.paid_by === user?.id ? "you" : exp.paid_by_name}</p>
                  </div>
                  <p className="font-semibold">{rupees(Number(exp.amount_paise))}</p>
                </li>
              ))}
            </ul>
          )}
          {expensesQuery.data && <Pagination pagination={expensesQuery.data.pagination} onPage={setExpensePage} />}
        </Card>

        <div className="flex flex-col gap-6">
          <RoomFundCard roomId={roomId} fund={latestFund} />

          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-1">
              <Scale className="h-4 w-4" /> Settle up
            </h2>
            <p className="text-xs text-foreground/50 mb-4">The fewest payments that square everyone up.</p>
            {settlements.length === 0 ? (
              <p className="text-sm text-foreground/55">Everyone&apos;s settled up.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {settlements.map((s) => (
                  <li key={`${s.fromUserId}-${s.toUserId}`} className="flex items-center gap-2 text-sm rounded-2xl bg-foreground/3 px-3 py-2.5">
                    <span className="font-medium truncate">{s.fromUserId === user?.id ? "You" : s.fromName}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                    <span className="font-medium truncate">{s.toUserId === user?.id ? "You" : s.toName}</span>
                    <span className="ml-auto font-semibold text-primary">{rupees(s.amountPaise)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold flex items-center gap-2 mb-4">
              <UsersIcon className="h-4 w-4" /> Members
            </h2>
            <ul className="flex flex-col gap-3">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center gap-3">
                  <Avatar name={m.name} picture={m.picture} size={32} />
                  <span className="text-sm font-medium truncate flex-1">
                    {m.name}
                    {m.user_id === user?.id && <span className="text-foreground/45 font-normal"> (you)</span>}
                  </span>
                  {m.role === "admin" && <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">Admin</span>}
                  {isAdmin && m.role !== "admin" && (
                    <button
                      onClick={() => handleRemove(m.user_id, m.name)}
                      className="p-1.5 rounded-full text-foreground/35 hover:text-danger hover:bg-danger/10"
                      aria-label={`Remove ${m.name}`}
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="mt-3">
              <FormMessage error={memberError} />
            </div>
            {!isAdmin && <p className="text-xs text-foreground/45 mt-3">Ask the admin for the invite code to add someone.</p>}
          </Card>
        </div>
      </div>

      <Modal open={modal === "expense"} onClose={() => setModal(null)} title="Add an expense">
        <AddExpenseForm
          roomId={roomId}
          members={members}
          onAdded={onExpenseAdded}
        />
      </Modal>
      {room.invite_code && (
        <Modal open={modal === "invite"} onClose={() => setModal(null)} title={`Invite to ${room.name}`}>
          <InviteShare
            roomName={room.name}
            inviteCode={room.invite_code}
            roomId={roomId}
            onCodeReset={() => {
              roomQuery.reload();
              reloadRooms(); // dashboard shows the code too
            }}
          />
        </Modal>
      )}
    </>
  );
}
