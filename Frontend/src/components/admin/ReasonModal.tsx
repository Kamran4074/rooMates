"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { Modal } from "@/components/ui/Modal";
import { TextArea } from "@/components/ui/TextArea";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

// "Why?" dialog for moderation actions (reject, remove, suspend). The reason
// is stored in the audit log, and for listings it's shown to the owner.
export function ReasonModal({
  open,
  title,
  label,
  confirmLabel,
  required = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  label: string;
  confirmLabel: string;
  required?: boolean;
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
        <TextArea label={label} required={required} minLength={required ? 3 : undefined} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
        <FormMessage error={error} />
        <Button type="submit" variant="dark" loading={busy}>
          {confirmLabel}
        </Button>
      </form>
    </Modal>
  );
}
