"use client";

import { deleteUser, suspendUser } from "@/services/adminApi";
import { ReasonModal } from "./ReasonModal";

export type UserAction = { type: "suspend" | "delete"; user: { id: string; name: string } } | null;

// The suspend and delete dialogs, shared by the users table and the user page.
// Errors from the API (e.g. "still has money to settle in: Flat 2B") show
// inside the dialog.
export function UserActionModals({ action, onClose, onDone }: { action: UserAction; onClose: () => void; onDone: () => void }) {
  const user = action?.user;
  return (
    <>
      <ReasonModal
        open={action?.type === "suspend"}
        title={`Suspend ${user?.name ?? ""}`}
        label="Reason (kept in the audit log)"
        confirmLabel="Suspend and sign them out"
        required={false}
        description="They're signed out everywhere and can't sign in until you restore the account. Nothing is deleted."
        onClose={onClose}
        onConfirm={async (reason) => {
          await suspendUser(user!.id, reason || undefined);
          onDone();
        }}
      />
      <ReasonModal
        open={action?.type === "delete"}
        title={`Delete ${user?.name ?? ""}?`}
        label="Reason (kept in the audit log)"
        confirmLabel="Delete account"
        danger
        description={
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Their name, email, phone and photo are erased and they can&apos;t sign in. This can&apos;t be undone.</li>
            <li>Groups only they were in are deleted. Groups they ran get the longest-standing member as admin.</li>
            <li>Expenses and payments stay in other people&apos;s groups as &quot;Deleted user&quot;.</li>
            <li>Not allowed while they still owe or are owed money in a group.</li>
          </ul>
        }
        onClose={onClose}
        onConfirm={async (reason) => {
          await deleteUser(user!.id, reason);
          onDone();
        }}
      />
    </>
  );
}
