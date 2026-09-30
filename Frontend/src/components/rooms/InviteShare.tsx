"use client";

import { Copy, Check, MessageCircle } from "lucide-react";
import { useCopyFeedback } from "@/lib/clipboard";
import { site } from "@/lib/site";

export function InviteShare({ roomName, inviteCode }: { roomName: string; inviteCode: string }) {
  const { copiedKey, copy } = useCopyFeedback();
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
    </div>
  );
}
