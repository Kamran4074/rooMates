"use client";

import Link from "next/link";
import { Bell, X } from "lucide-react";
import { useToastStore } from "@/store/toastStore";

// Bottom-right on desktop, bottom-centre on phones. role="status" + aria-live
// so screen readers announce new toasts without stealing focus.
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed z-50 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 flex flex-col gap-2 sm:w-96 pointer-events-none"
    >
      {toasts.map((t) => {
        const body = (
          <>
            <Bell className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <span className="flex-1 text-sm">{t.message}</span>
          </>
        );
        return (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-card-border bg-card shadow-2xl px-4 py-3">
            {t.href ? (
              <Link href={t.href} onClick={() => dismiss(t.id)} className="flex items-start gap-3 flex-1 min-w-0 hover:text-primary">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 flex-1 min-w-0">{body}</div>
            )}
            <button onClick={() => dismiss(t.id)} className="p-0.5 rounded-full text-foreground/40 hover:text-foreground" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
