"use client";

import Link from "next/link";
import { useShallow } from "zustand/react/shallow";
import { Plus, LogIn, Copy, Check, ArrowUpRight, ArrowDownLeft, Home as HomeIcon, Sparkles } from "lucide-react";
import { rupees, firstName } from "@/lib/format";
import { useCopyFeedback } from "@/lib/clipboard";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Me } from "@/lib/types";
import { useAuthStore } from "@/store/authStore";
import { useRoomsStore } from "@/store/roomsStore";
import { useRoomModal } from "@/store/roomModalStore";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { FormMessage } from "@/components/ui/FormMessage";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/Skeleton";

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  // useShallow: re-render only when these three values change, not on every store update.
  const { rooms, loaded, error } = useRoomsStore(useShallow((s) => ({ rooms: s.rooms, loaded: s.loaded, error: s.error })));
  const showModal = useRoomModal((s) => s.show);
  const { copiedKey, copy } = useCopyFeedback();
  // Refetch plan usage when the number of rooms changes (room_count moves).
  const { data: me } = useApiQuery<Me>("/api/users/me", rooms.length);

  // Each room already carries my net balance (computed server-side in one query).
  const totalOwedToMe = rooms.reduce((sum, r) => sum + Math.max(r.my_net_paise, 0), 0);
  const totalIOwe = rooms.reduce((sum, r) => sum + Math.min(r.my_net_paise, 0), 0);

  return (
    <>
      <PageHeader
        title={`Hello ${firstName(user?.name)}`}
        subtitle="Here's where things stand across your rooms."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => showModal("join")}>
              <LogIn className="h-4 w-4" /> Join room
            </Button>
            <Button variant="dark" size="sm" onClick={() => showModal("create")}>
              <Plus className="h-4 w-4" /> New room
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <Card className="lg:col-span-2 p-6 rounded-3xl">
          <h2 className="font-semibold mb-5">Across all your rooms</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={<ArrowDownLeft className="h-4 w-4" />} tone="success" label="You are owed" value={rupees(totalOwedToMe)} />
            <StatCard icon={<ArrowUpRight className="h-4 w-4" />} tone="danger" label="You owe" value={rupees(totalIOwe)} />
            <StatCard icon={<HomeIcon className="h-4 w-4" />} tone="primary" label="Active rooms" value={String(rooms.length)} />
          </div>
        </Card>

        <Card className="p-6 rounded-3xl flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold">Your plan usage</h2>
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              {me?.plan ?? "free"}
            </span>
          </div>
          <div className="flex items-baseline justify-between mb-2 text-sm">
            <span className="font-medium">Rooms</span>
            <span className="text-foreground/55">
              <strong className="text-foreground">{me?.room_count ?? rooms.length}</strong> of {me?.max_rooms ?? 2}
            </span>
          </div>
          <ProgressBar value={me?.room_count ?? rooms.length} max={me?.max_rooms ?? 2} />
          <p className="text-xs text-foreground/50 mt-3 mb-5">Rooms you create count toward your plan. Rooms you join don&apos;t.</p>
          <Button variant="outline" size="sm" className="mt-auto w-full" disabled title="Coming soon">
            <Sparkles className="h-4 w-4" /> Upgrade — coming soon
          </Button>
        </Card>
      </div>

      <FormMessage error={error} />

      {loaded && rooms.length === 0 ? (
        <GetStarted onCreate={() => showModal("create")} onJoin={() => showModal("join")} />
      ) : (
        <section>
          <h2 className="font-semibold text-lg mb-4">Your rooms</h2>
          {!loaded ? (
            <LoadingState variant="cards" rows={3} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {rooms.map((room) => {
                const net = room.my_net_paise;
                return (
                  <Card key={room.id} className="p-5 rounded-3xl flex flex-col gap-4 hover:shadow-lg hover:shadow-foreground/5 transition-shadow">
                    <Link href={`/rooms/${room.id}`} className="flex items-center gap-3">
                      <RoomIcon type={room.type} />
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{room.name}</h3>
                        <p className="text-xs text-foreground/50">{room.type === "trip" ? "Trip" : "Flat"}</p>
                      </div>
                    </Link>
                    <p className="text-sm">
                      {net > 0 ? (
                        <span className="text-success font-medium">You are owed {rupees(net)}</span>
                      ) : net < 0 ? (
                        <span className="text-danger font-medium">You owe {rupees(net)}</span>
                      ) : (
                        <span className="text-foreground/55">All settled up</span>
                      )}
                    </p>
                    {/* Only the admin is sent the code - members can't pass it on. */}
                    {room.invite_code ? (
                      <button
                        onClick={() => copy(room.invite_code!, room.id)}
                        className="mt-auto flex items-center gap-1.5 text-xs text-foreground/50 hover:text-primary"
                      >
                        {copiedKey === room.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedKey === room.id ? "Copied!" : `Invite code: ${room.invite_code}`}
                      </button>
                    ) : (
                      <p className="mt-auto text-xs text-foreground/45">Member</p>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function GetStarted({ onCreate, onJoin }: { onCreate: () => void; onJoin: () => void }) {
  const steps = [
    { n: 1, title: "Create your first room", desc: "Make a room for your flat or an upcoming trip.", action: "Create a room", onClick: onCreate },
    { n: 2, title: "Or join a roommate's room", desc: "Got an invite code? Jump straight into their room.", action: "Join with a code", onClick: onJoin },
  ];
  return (
    <Card className="p-8 rounded-3xl bg-accent/6">
      <h2 className="text-xl font-semibold mb-6">Get started with RooMates</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {steps.map((s) => (
          <div key={s.n} className="flex gap-4 items-start bg-card rounded-2xl border border-card-border p-5">
            <span className="text-5xl font-extrabold text-primary leading-none">{s.n}</span>
            <div className="flex-1">
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm text-foreground/55 mb-3">{s.desc}</p>
              <button onClick={s.onClick} className="text-sm font-medium text-primary inline-flex items-center gap-1">
                {s.action} →
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
