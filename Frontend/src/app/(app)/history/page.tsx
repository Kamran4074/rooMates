"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CalendarRange, Receipt, Wallet, Scale } from "lucide-react";
import { useApiQuery } from "@/lib/useApiQuery";
import { rupees } from "@/lib/format";
import { monthLabel } from "@/lib/month";
import type { MonthSummary } from "@/lib/types";
import { useRoomsStore } from "@/store/roomsStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Table, Th, Td, MobileList } from "@/components/ui/Table";
import { FormMessage } from "@/components/ui/FormMessage";

export default function HistoryPage() {
  const rooms = useRoomsStore((s) => s.rooms);
  const [roomId, setRoomId] = useState("");
  const { data, loading, error } = useApiQuery<MonthSummary[]>(
    `/api/expenses/monthly-summary${roomId ? `?roomId=${roomId}` : ""}`
  );
  const months = data ?? [];
  const monthHref = (month: string) => `/expenses?month=${month}${roomId ? `&room=${roomId}` : ""}`;

  const allTime = months.reduce(
    (acc, m) => ({ total: acc.total + m.totalPaise, paid: acc.paid + m.iPaidPaise, net: acc.net + m.netPaise }),
    { total: 0, paid: 0, net: 0 }
  );

  return (
    <>
      <PageHeader
        title="History"
        subtitle="How each month added up."
        actions={
          <div className="w-56">
            <Select value={roomId} onChange={(e) => setRoomId(e.target.value)} aria-label="Filter by room">
              <option value="">All rooms</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={<CalendarRange className="h-4 w-4" />} tone="primary" label="Months tracked" value={String(months.length)} />
        <StatCard icon={<Receipt className="h-4 w-4" />} tone="primary" label="Total spent (all time)" value={rupees(allTime.total)} />
        <StatCard icon={<Wallet className="h-4 w-4" />} tone="accent" label="You paid (all time)" value={rupees(allTime.paid)} />
        <StatCard
          icon={<Scale className="h-4 w-4" />}
          tone={allTime.net >= 0 ? "success" : "danger"}
          label={allTime.net >= 0 ? "Net: others owe you" : "Net: you owe"}
          value={rupees(allTime.net)}
          hint="before settle-ups"
        />
      </div>

      <FormMessage error={error} />

      <Card className="rounded-3xl p-6">
        {loading ? (
          <p className="text-foreground/50 py-8 text-center">Loading...</p>
        ) : months.length === 0 ? (
          <p className="text-foreground/55 py-12 text-center">No expenses yet — your monthly history will show up here.</p>
        ) : (
          <>
          <MobileList>
            {months.map((m) => (
              <li key={m.month}>
                <Link href={monthHref(m.month)} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{monthLabel(m.month)}</p>
                    <p className="text-xs text-foreground/50">
                      {m.expenseCount} {m.expenseCount === 1 ? "expense" : "expenses"} · {rupees(m.totalPaise)} total
                    </p>
                    <p className="text-xs text-foreground/50">
                      You paid {rupees(m.iPaidPaise)} · your share {rupees(m.mySharePaise)}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold ${m.netPaise > 0 ? "text-success" : m.netPaise < 0 ? "text-danger" : "text-foreground/50"}`}>
                    {m.netPaise === 0 ? "—" : `${m.netPaise > 0 ? "+" : "−"}${rupees(m.netPaise)}`}
                  </span>
                  <ChevronRight className="h-4 w-4 text-foreground/40 shrink-0" />
                </Link>
              </li>
            ))}
          </MobileList>
          <Table className="hidden sm:block">
            <thead>
              <tr>
                <Th>Month</Th>
                <Th align="right">Expenses</Th>
                <Th align="right">Total spent</Th>
                <Th align="right">You paid</Th>
                <Th align="right">Your share</Th>
                <Th align="right">Net</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {months.map((m) => {
                const href = monthHref(m.month);
                return (
                  <tr key={m.month} className="hover:bg-foreground/2">
                    <Td className="font-medium whitespace-nowrap">
                      <Link href={href} className="hover:text-primary">
                        {monthLabel(m.month)}
                      </Link>
                    </Td>
                    <Td align="right">{m.expenseCount}</Td>
                    <Td align="right" className="font-semibold">
                      {rupees(m.totalPaise)}
                    </Td>
                    <Td align="right">{rupees(m.iPaidPaise)}</Td>
                    <Td align="right">{rupees(m.mySharePaise)}</Td>
                    <Td align="right" className={`font-medium ${m.netPaise > 0 ? "text-success" : m.netPaise < 0 ? "text-danger" : "text-foreground/50"}`}>
                      {m.netPaise === 0 ? "—" : `${m.netPaise > 0 ? "+" : "−"}${rupees(m.netPaise)}`}
                    </Td>
                    <Td align="right">
                      <Link href={href} className="inline-flex p-1.5 rounded-full hover:bg-foreground/5 text-foreground/50" aria-label={`View ${monthLabel(m.month)}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          </>
        )}
      </Card>
    </>
  );
}
