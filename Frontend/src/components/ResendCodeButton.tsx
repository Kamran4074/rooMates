"use client";

import { useEffect, useState } from "react";
import { errorMessage } from "@/lib/api";

// Mirrors the backend's 60s resend cooldown so the button can't be spammed.
const COOLDOWN_SECONDS = 60;

export function ResendCodeButton({
  onResend,
  onError,
}: {
  onResend: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(COOLDOWN_SECONDS);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  async function handleClick() {
    setSending(true);
    try {
      await onResend();
      setSecondsLeft(COOLDOWN_SECONDS);
    } catch (err) {
      onError(errorMessage(err, "Couldn't send a new code. Please try again."));
    } finally {
      setSending(false);
    }
  }

  if (secondsLeft > 0) {
    return <span className="text-sm text-foreground/50">Resend code in {secondsLeft}s</span>;
  }

  return (
    <button type="button" onClick={handleClick} disabled={sending} className="text-sm text-primary font-medium disabled:opacity-50">
      {sending ? "Sending..." : "Resend code"}
    </button>
  );
}
