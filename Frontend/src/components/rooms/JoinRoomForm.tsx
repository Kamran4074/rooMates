"use client";

import { useState } from "react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import type { RoomType } from "@/lib/types";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export interface JoinedRoom {
  id: string;
  name: string;
  type: RoomType;
}

export function JoinRoomForm({ onJoined, submitLabel = "Join room" }: { onJoined: (room: JoinedRoom) => void; submitLabel?: string }) {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onJoined(await apiAuthPost<JoinedRoom>("/api/rooms/join", { inviteCode: inviteCode.trim() }));
    } catch (err) {
      setError(errorMessage(err, "Failed to join room"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        label="Invite code"
        required
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
        placeholder="e.g. YJ383ZDK"
        className="tracking-[0.3em] font-mono uppercase"
      />
      <p className="text-xs text-foreground/50 -mt-2">Ask your roommate for the 8-character code from their room.</p>
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting}>
        {submitting ? "Joining..." : submitLabel}
      </Button>
    </form>
  );
}
