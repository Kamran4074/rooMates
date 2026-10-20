"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiAuthPost, errorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { PasswordField } from "@/components/ui/PasswordField";
import { FormMessage } from "@/components/ui/FormMessage";

// The user's own "Delete account". The server anonymises the account (the
// same rules as the admin's delete) and refuses while money is unsettled -
// that message is shown here as-is, naming the rooms to settle first.
export function DeleteAccountCard({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setConfirm("");
    setPassword("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiAuthPost("/api/users/me/delete", { confirm, ...(hasPassword && { password }) });
      // Every session was already revoked server-side; just drop this one.
      useAuthStore.getState().logout();
      router.replace("/");
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete your account"));
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-3xl p-6 sm:p-8 max-w-2xl mt-6 border-red-500/30">
      <h2 className="font-semibold mb-2">Delete account</h2>
      <p className="text-sm text-foreground/65 mb-5">
        Your name, email, phone and photo are erased and you&apos;re signed out everywhere. Expenses you shared stay in
        your rooms as &quot;Deleted user&quot; so your flatmates&apos; balances still add up. This can&apos;t be undone.
      </p>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Delete my account
      </Button>

      <Modal open={open} onClose={close} title="Delete your account?">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <ul className="text-sm text-foreground/70 list-disc pl-5 space-y-1">
            <li>You must be settled up in every room first.</li>
            <li>Rooms only you are in are deleted; rooms you run get a new admin.</li>
            <li>Your listings are taken down.</li>
          </ul>
          {hasPassword && (
            <PasswordField label="Your password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
          <TextField label='Type DELETE to confirm' required autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <FormMessage error={error} />
          <Button type="submit" variant="danger" loading={busy} disabled={confirm !== "DELETE" || (hasPassword && !password)}>
            Delete my account forever
          </Button>
        </form>
      </Modal>
    </Card>
  );
}
