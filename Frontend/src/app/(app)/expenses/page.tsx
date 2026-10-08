"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Receipt, Wallet, PieChart, Scale } from "lucide-react";
import { useApiQuery } from "@/lib/useApiQuery";
import { rupees, formatDate } from "@/lib/format";
import { currentMonth, shiftMonth, monthLabel, isValidMonth } from "@/lib/month";
import type { MyExpense } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { useRoomsStore } from "@/store/roomsStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { FundApprovalsCard } from "@/components/funds/FundApprovalsCard";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Th, Td, MobileList } from "@/components/ui/Table";
import { FormMessage } from "@/components/ui/FormMessage";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { AddExpenseAnyRoom } from "@/components/rooms/AddExpenseAnyRoom";
import { LoadingState } from "@/components/ui/Skeleton";

// useSearchParams needs a Suspense boundary or `next build` fails for this route.
export default function ExpensesPage() {
  return (
    <Suspense>
      <Expenses />
    </Suspense>
  );
}

function Expenses() {
  const router = useRouter();
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const rooms = useRoomsStore((s) => s.rooms);
  const reloadRooms = useRoomsStore((s) => s.load);

  const month = isValidMonth(params.get("month")) ? params.get("month")! : currentMonth();
  const roomId = params.get("room") ?? "";
  const isCurrentMonth = month >= currentMonth();
  const [adding, setAdding] = useState(false);

  const query = new URLSearchParams({ month, ...(roomId && { roomId }) });
  const { data, loading, error, reload } = useApiQuery<MyExpense[]>(`/api/expenses?${query}`);
  const expenses = data ?? [];

  const setFilter = (next: { month?: string; room?: string }) => {
    const query = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    router.replace(`/expenses?${query}`);
  };

  const total = expenses.reduce((s, e) => s + e.amount_paise, 0);
  const iPaid = expenses.filter((e) => e.paid_by === user?.id).reduce((s, e) => s + e.amount_paise, 0);
  const myShare = expenses.reduce((s, e) => s + e.my_share_paise, 0);
  const net = iPaid - myShare;

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle="Every shared expense across your rooms, month by month."
        actions={
          <Button variant="dark" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add expense
          </Button>
        }
      />

      <FundApprovalsCard />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1 rounded-full border border-card-border bg-card p-1">
          <button onClick={() => setFilter({ month: shiftMonth(month, -1) })} className="p-1.5 rounded-full hover:bg-foreground/5" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-36 text-center text-sm font-semibold">{monthLabel(month)}</span>
          <button
            onClick={() => setFilter({ month: shiftMonth(month, 1) })}
            disabled={isCurrentMonth}
            className="p-1.5 rounded-full hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="w-56">
          <Select value={roomId} onChange={(e) => setFilter({ room: e.target.value })} aria-label="Filter by room">
            <option value="">All rooms</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<Receipt className="h-4 w-4" />} tone="primary" label="Total spent" value={rupees(total)} hint={`${expenses.length} expenses`} />
        <StatCard icon={<Wallet className="h-4 w-4" />} tone="accent" label="You paid" value={rupees(iPaid)} />
        <StatCard icon={<PieChart className="h-4 w-4" />} tone="primary" label="Your share" value={rupees(myShare)} />
        <StatCard
          icon={<Scale className="h-4 w-4" />}
          tone={net >= 0 ? "success" : "danger"}
          label={net >= 0 ? "Others owe you" : "You owe"}
          value={rupees(net)}
          hint="for this month"
        />
      </div>

      <FormMessage error={error} />

      <Card className="rounded-3xl p-6">
        {loading ? (
          <LoadingState />
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-foreground/55 mb-4">No expenses in {monthLabel(month)}.</p>
            <Button variant="dark" size="sm" onClick={() => setAdding(true)}>
              <Plus className="h-4 w-4" /> Add expense
            </Button>
          </div>
        ) : (
          <>
          <MobileList>
            {expenses.map((e) => (
              <li key={e.id} className="py-3 flex gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{e.description}</p>
                  <p className="text-xs text-foreground/50 truncate">
                    {formatDate(e.expense_date, "short")} ·{" "}
                    <Link href={`/rooms/${e.room_id}`} className="hover:text-primary">
                      {e.room_name}
                    </Link>{" "}
                    · {e.paid_by === user?.id ? "You paid" : `${e.paid_by_name} paid`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{rupees(e.amount_paise)}</p>
                  <p className="text-xs text-foreground/50">{e.my_share_paise ? `Your share ${rupees(e.my_share_paise)}` : "Not in split"}</p>
                </div>
              </li>
            ))}
          </MobileList>
          <Table className="hidden sm:block">
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Room</Th>
                <Th>Paid by</Th>
                <Th align="right">Amount</Th>
                <Th align="right">Your share</Th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id} className="hover:bg-foreground/2">
                  <Td className="whitespace-nowrap text-foreground/55">{formatDate(e.expense_date, "short")}</Td>
                  <Td className="font-medium">{e.description}</Td>
                  <Td>
                    <Link href={`/rooms/${e.room_id}`} className="inline-flex items-center gap-2 hover:text-primary whitespace-nowrap">
                      <RoomIcon type={e.room_type} size="sm" /> {e.room_name}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{e.paid_by === user?.id ? "You" : e.paid_by_name}</Td>
                  <Td align="right" className="font-semibold">
                    {rupees(e.amount_paise)}
                  </Td>
                  <Td align="right" className="text-foreground/70">
                    {e.my_share_paise ? rupees(e.my_share_paise) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          </>
        )}
      </Card>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add an expense">
        <AddExpenseAnyRoom
          defaultRoomId={roomId || undefined}
          onAdded={() => {
            setAdding(false);
            reloadRooms(); // keeps dashboard/sidebar balances in sync
            // New expenses are dated now, so show the current month.
            if (isCurrentMonth) reload();
            else setFilter({ month: currentMonth() });
          }}
        />
      </Modal>
    </>
  );
}
