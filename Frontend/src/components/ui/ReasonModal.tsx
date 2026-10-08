"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

// "Why?" dialog: admin moderation (reject, remove, suspend, delete) and a
// member disputing a fund payment. The reason is kept with the action.
export function ReasonModal({
  open,
  title,
  label,
  confirmLabel,
  required = true,
  description,
  danger = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  required?: boolean;
  /** What will happen, shown above the reason box. */
  description?: React.ReactNode;
  /** Red confirm button for destructive actions (delete). */
  danger?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {description && <div className="text-sm text-foreground/70">{description}</div>}
        <TextArea label={label} required={required} minLength={required ? 3 : undefined} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        <FormMessage error={error} />
        <Button type="submit" variant={danger ? "danger" : "dark"} loading={busy}>
          {confirmLabel}
        </Button>
      </form>
    </Modal>
  );
}
