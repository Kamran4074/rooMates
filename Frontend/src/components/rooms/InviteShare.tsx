"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle, RefreshCw } from "lucide-react";
import { useCopyFeedback } from "@/lib/clipboard";
import { apiAuthPost, errorMessage } from "@/lib/api";
import { site } from "@/lib/site";
import { FormMessage } from "@/components/ui/FormMessage";

// `roomId` enables "Reset code" (admin only) - for a code that got shared too
// widely. The old code stops working immediately.
export function InviteShare({
  roomName,
  inviteCode: initialCode,
  roomId,
  onCodeReset,
}: {
  roomName: string;
  inviteCode: string;
  roomId?: string;
  onCodeReset?: () => void;
}) {
  const { copiedKey, copy } = useCopyFeedback();
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    if (!roomId || !window.confirm("Make a new code? The current one will stop working.")) return;
    setResetting(true);
    setError(null);
    try {
      const { inviteCode: next } = await apiAuthPost<{ inviteCode: string }>(`/api/rooms/${roomId}/invite-code`, {});
      setInviteCode(next);
      onCodeReset?.();
    } catch (err) {
      setError(errorMessage(err, "Couldn't reset the code"));
    } finally {
      setResetting(false);
    }
  }
  const message = `Join my room "${roomName}" on RooMates to split expenses. Sign up at ${site.url}/signup and use invite code ${inviteCode}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5 text-center">
        <p className="text-xs uppercase tracking-wider text-foreground/50 mb-2">Invite code</p>
        <p className="font-mono text-3xl font-bold tracking-[0.3em] text-secondary dark:text-foreground">{inviteCode}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => copy(message, "message")}
          className="h-11 rounded-full border border-card-border bg-card hover:bg-foreground/5 inline-flex items-center justify-center gap-2 text-sm font-medium"
        >
          {copiedKey === "message" ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          {copiedKey === "message" ? "Copied!" : "Copy invite"}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="h-11 rounded-full bg-[#25D366] text-white hover:opacity-90 inline-flex items-center justify-center gap-2 text-sm font-medium"
        >
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </a>
      </div>
      {roomId && (
        <>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="self-center inline-flex items-center gap-1.5 text-xs text-foreground/50 hover:text-danger disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} /> Reset code
          </button>
          <FormMessage error={error} />
        </>
      )}
    </div>
  );
}
