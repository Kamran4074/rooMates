"use client";

import { useState } from "react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import type { RoomType } from "@/lib/types";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

// An invite code only files a request: the room's admin has to approve it
// before the person can see anything (POST /api/rooms/join -> 202).
export interface JoinRequested {
  id: string;
  name: string;
  type: RoomType;
  status: "pending";
  requestId: string;
}

export function JoinRoomForm({
  onRequested,
  submitLabel = "Request to join",
}: {
  onRequested: (room: JoinRequested) => void;
  submitLabel?: string;
}) {
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onRequested(await apiAuthPost<JoinRequested>("/api/rooms/join", { inviteCode: inviteCode.trim() }));
    } catch (err) {
      setError(errorMessage(err, "Couldn't send the request"));
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
      <p className="text-xs text-foreground/50 -mt-2">Ask your roommate for the 8-character code. The room&apos;s admin approves you before you get in.</p>
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting}>
        {submitting ? "Sending..." : submitLabel}
      </Button>
    </form>
  );
}
