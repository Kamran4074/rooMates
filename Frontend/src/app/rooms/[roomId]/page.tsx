"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Copy, Check, Receipt, ArrowRight, Users as UsersIcon } from "lucide-react";
import { apiAuthGet, apiAuthPost, errorMessage } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

interface Room {
  id: string;
  name: string;
  type: "roommates" | "trip";
  invite_code: string;
}

interface Member {
  user_id: string;
  role: "admin" | "member";
  name: string;
  email: string;
  picture: string | null;
}

interface Expense {
  id: string;
  description: string;
  amount_paise: string;
  paid_by: string;
  paid_by_name: string;
  created_at: string;
}

interface Balance {
  userId: string;
  name: string;
  netPaise: number;
}

interface Settlement {
  fromUserId: string;
  toUserId: string;
  amountPaise: number;
  fromName: string;
  toName: string;
}

const rupees = (paise: number) => `₹${(Math.abs(paise) / 100).toFixed(2)}`;

export default function RoomPage() {
  const params = useParams<{ roomId: string }>();
  const { user, ready } = useRequireAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [roomData, membersData, expensesData, balancesData] = await Promise.all([
        apiAuthGet<Room>(`/api/rooms/${params.roomId}`),
        apiAuthGet<Member[]>(`/api/rooms/${params.roomId}/members`),
        apiAuthGet<Expense[]>(`/api/rooms/${params.roomId}/expenses`),
        apiAuthGet<{ balances: Balance[]; settlements: Settlement[] }>(`/api/rooms/${params.roomId}/balances`),
      ]);
      setRoom(roomData);
      setMembers(membersData);
      setExpenses(expensesData);
      setBalances(balancesData.balances);
      setSettlements(balancesData.settlements);
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load room"));
    } finally {
      setLoading(false);
    }
  }, [params.roomId]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  function copyInvite() {
    if (!room) return;
    navigator.clipboard.writeText(room.invite_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!ready) return null;
  if (loading) return <div className="min-h-screen flex items-center justify-center text-foreground/50">Loading room...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-danger">{error}</div>;
  if (!room) return null;

  const myBalance = balances.find((b) => b.userId === user?.id);

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-lg hover:bg-foreground/5">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="font-bold">{room.name}</h1>
              <p className="text-xs text-foreground/50 capitalize">{room.type}</p>
            </div>
          </div>
          <button onClick={copyInvite} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-card-border hover:bg-foreground/5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : room.invite_code}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 flex flex-col gap-6">
          {myBalance && (
            <Card className={`p-5 ${myBalance.netPaise > 0 ? "bg-success/10 border-success/30" : myBalance.netPaise < 0 ? "bg-danger/10 border-danger/30" : ""}`}>
              {myBalance.netPaise === 0 ? (
                <p className="font-medium">You&apos;re all settled up in this room.</p>
              ) : myBalance.netPaise > 0 ? (
                <p className="font-medium text-success">You are owed {rupees(myBalance.netPaise)} overall</p>
              ) : (
                <p className="font-medium text-danger">You owe {rupees(myBalance.netPaise)} overall</p>
              )}
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><Receipt className="h-4 w-4" /> Expenses</h2>
              <Button type="button" className="px-3 text-sm" onClick={() => setShowAddExpense((v) => !v)}>
                <Plus className="h-4 w-4" /> Add expense
              </Button>
            </div>

            {showAddExpense && (
              <AddExpenseForm
                roomId={params.roomId}
                members={members}
                onAdded={() => { setShowAddExpense(false); load(); }}
              />
            )}

            {expenses.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-card-border rounded-xl text-foreground/50">
                No expenses yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {expenses.map((exp) => (
                  <Card key={exp.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{exp.description}</p>
                      <p className="text-xs text-foreground/50">Paid by {exp.paid_by_name}</p>
                    </div>
                    <p className="font-semibold">{rupees(Number(exp.amount_paise))}</p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-3"><UsersIcon className="h-4 w-4" /> Members</h2>
            <Card className="divide-y divide-card-border">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 p-3">
                  {m.picture ? (
                    <img src={m.picture} alt={m.name} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
                      {m.name[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                  </div>
                  {m.role === "admin" && <span className="text-[10px] uppercase tracking-wide text-primary font-semibold">Admin</span>}
                </div>
              ))}
            </Card>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Settle up</h2>
            {settlements.length === 0 ? (
              <p className="text-sm text-foreground/50">Everyone&apos;s settled up.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {settlements.map((s, i) => (
                  <Card key={i} className="p-3 flex items-center gap-2 text-sm">
                    <span className="font-medium">{s.fromName}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-foreground/40 shrink-0" />
                    <span className="font-medium">{s.toName}</span>
                    <span className="ml-auto font-semibold text-primary">{rupees(s.amountPaise)}</span>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AddExpenseForm({ roomId, members, onAdded }: { roomId: string; members: Member[]; onAdded: () => void }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [splitType, setSplitType] = useState<"equal" | "custom">("equal");
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const customTotal = Object.values(customSplits).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  const amountNum = parseFloat(amount) || 0;
  const customMismatch = splitType === "custom" && Math.abs(customTotal - amountNum) > 0.01;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body =
        splitType === "equal"
          ? { description, amount: amountNum, splitType: "equal" as const }
          : {
              description,
              amount: amountNum,
              splitType: "custom" as const,
              splits: members.map((m) => ({ userId: m.user_id, amount: parseFloat(customSplits[m.user_id] || "0") })),
            };
      await apiAuthPost(`/api/rooms/${roomId}/expenses`, body);
      onAdded();
    } catch (err) {
      setError(errorMessage(err, "Failed to add expense"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit} className="p-5 mb-4 flex flex-col gap-3">
      <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was this for?" required />
      <TextField
        label="Amount (₹)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        type="number"
        step="0.01"
        min="0.01"
        required
      />
      <div className="flex gap-2">
        <button type="button" onClick={() => setSplitType("equal")} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${splitType === "equal" ? "bg-primary text-white border-primary" : "border-card-border"}`}>
          Split equally
        </button>
        <button type="button" onClick={() => setSplitType("custom")} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${splitType === "custom" ? "bg-primary text-white border-primary" : "border-card-border"}`}>
          Custom split
        </button>
      </div>

      {splitType === "custom" && (
        <div className="flex flex-col gap-2 border border-card-border rounded-lg p-3">
          {members.map((m) => (
            <div key={m.user_id} className="flex items-center gap-2">
              <span className="text-sm flex-1 truncate">{m.name}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={customSplits[m.user_id] ?? ""}
                onChange={(e) => setCustomSplits((prev) => ({ ...prev, [m.user_id]: e.target.value }))}
                className="w-24 px-2 py-1 rounded-md border border-card-border bg-background text-sm outline-none focus:border-primary"
              />
            </div>
          ))}
          <p className={`text-xs ${customMismatch ? "text-danger" : "text-success"}`}>
            Total: ₹{customTotal.toFixed(2)} / ₹{amountNum.toFixed(2) || "0.00"}
          </p>
        </div>
      )}

      <FormMessage error={error} />
      <Button type="submit" loading={submitting} disabled={splitType === "custom" && customMismatch}>
        {submitting ? "Adding..." : "Add expense"}
      </Button>
    </Card>
  );
}
