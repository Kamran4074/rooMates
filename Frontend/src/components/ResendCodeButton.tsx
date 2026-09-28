"use client";

import { useEffect, useState } from "react";

// Mirrors the backend's 60s resend cooldown so the button can't be spammed.
const COOLDOWN_SECONDS = 60;

export function ResendCodeButton({ onResend }: { onResend: () => Promise<void> }) {
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
