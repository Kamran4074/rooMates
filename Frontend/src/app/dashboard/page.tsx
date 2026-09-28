"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, LogIn, LogOut, Home as HomeIcon, Plane, Copy, Check } from "lucide-react";
import { apiAuthGet, apiAuthPost, errorMessage } from "@/lib/api";
import { useRequireAuth, useLogout } from "@/lib/auth";
import { Card } from "@/components/ui/Card";
import { FormMessage } from "@/components/ui/FormMessage";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Logo } from "@/components/Logo";

interface Room {
  id: string;
  name: string;
  type: "roommates" | "trip";
  invite_code: string;
  created_at: string;
}

export default function DashboardPage() {
  const { user, ready } = useRequireAuth();
  const logout = useLogout();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (ready) loadRooms();
  }, [ready]);

  async function loadRooms() {
    try {
      setLoading(true);
      setRooms(await apiAuthGet<Room[]>("/api/rooms"));
      setError(null);
    } catch (err) {
      setError(errorMessage(err, "Failed to load rooms"));
    } finally {
      setLoading(false);
    }
  }

  function copyInvite(room: Room) {
    navigator.clipboard.writeText(room.invite_code).catch(() => {});
    setCopiedId(room.id);
    setTimeout(() => setCopiedId(null), 1500);
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-card-border bg-card/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <Logo size={32} />
            RooMates
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-foreground/60 hidden sm:inline">{user?.name}</span>
            {user?.picture && (
              <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full" referrerPolicy="no-referrer" />
            )}
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-foreground/5 text-foreground/60"
              title="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Your rooms</h1>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="px-4 text-sm"
              onClick={() => { setShowJoin((v) => !v); setShowCreate(false); }}
            >
              <LogIn className="h-4 w-4" /> Join room
            </Button>
            <Button
              type="button"
              className="px-4 text-sm"
              onClick={() => { setShowCreate((v) => !v); setShowJoin(false); }}
            >
              <Plus className="h-4 w-4" /> New room
            </Button>
          </div>
        </div>

        {showCreate && <CreateRoomForm onCreated={() => { setShowCreate(false); loadRooms(); }} />}
        {showJoin && <JoinRoomForm onJoined={() => { setShowJoin(false); loadRooms(); }} />}

        <div className="mb-4">
          <FormMessage error={error} />
        </div>

        {loading ? (
          <p className="text-foreground/50">Loading rooms...</p>
        ) : rooms.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-card-border rounded-xl">
            <p className="text-foreground/50">No rooms yet — create one or join with an invite code.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <Card key={room.id} className="p-5 hover:shadow-lg hover:shadow-primary/5 transition-shadow">
                <Link href={`/rooms/${room.id}`} className="flex items-center gap-3 mb-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${room.type === "trip" ? "bg-accent/15 text-accent" : "bg-primary/10 text-primary"}`}>
                    {room.type === "trip" ? <Plane className="h-5 w-5" /> : <HomeIcon className="h-5 w-5" />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{room.name}</h3>
                    <p className="text-xs text-foreground/50 capitalize">{room.type}</p>
                  </div>
                </Link>
                <button
                  onClick={() => copyInvite(room)}
                  className="flex items-center gap-1.5 text-xs text-foreground/50 hover:text-primary"
                >
                  {copiedId === room.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === room.id ? "Copied!" : `Invite code: ${room.invite_code}`}
                </button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function CreateRoomForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"roommates" | "trip">("roommates");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiAuthPost("/api/rooms", { name, type });
      onCreated();
    } catch (err) {
      setError(errorMessage(err, "Failed to create room"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit} className="p-5 mb-6 flex flex-col gap-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => setType("roommates")} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${type === "roommates" ? "bg-primary text-white border-primary" : "border-card-border"}`}>
          Roommates
        </button>
        <button type="button" onClick={() => setType("trip")} className={`flex-1 py-2 rounded-lg text-sm font-medium border ${type === "trip" ? "bg-accent text-white border-accent" : "border-card-border"}`}>
          Trip
        </button>
      </div>
      <TextField
        label="Room name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={type === "trip" ? "e.g. Goa Trip" : "e.g. Flat 3B"}
        required
      />
      <FormMessage error={error} />
      <Button type="submit" loading={submitting}>
        {submitting ? "Creating..." : "Create room"}
      </Button>
    </Card>
  );
}

function JoinRoomForm({ onJoined }: { onJoined: () => void }) {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiAuthPost("/api/rooms/join", { inviteCode });
      onJoined();
    } catch (err) {
      setError(errorMessage(err, "Failed to join room"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card as="form" onSubmit={handleSubmit} className="p-5 mb-6 flex flex-col gap-3">
      <TextField
        label="Invite code"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
        placeholder="Enter invite code"
        required
        className="tracking-widest font-mono"
      />
      <FormMessage error={error} />
      <Button type="submit" loading={submitting}>
        {submitting ? "Joining..." : "Join room"}
      </Button>
    </Card>
  );
}
