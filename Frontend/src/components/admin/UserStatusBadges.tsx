import { Badge } from "@/components/ui/Badge";
import type { AdminUser } from "@/lib/types";

const INACTIVE_AFTER_DAYS = 30;

// Same "inactive" rule as the API's status filter: no sign-in or session
// refresh in the last 30 days.
export function isInactive(user: Pick<AdminUser, "last_active_at">) {
  if (!user.last_active_at) return true;
  return Date.now() - new Date(user.last_active_at).getTime() > INACTIVE_AFTER_DAYS * 24 * 60 * 60 * 1000;
}

export function UserStatusBadges({ user }: { user: Pick<AdminUser, "role" | "suspended_at" | "deleted_at" | "last_active_at"> }) {
  if (user.deleted_at) return <Badge tone="neutral">Deleted</Badge>;
  return (
    <>
      {user.role === "super_admin" && <Badge tone="primary">Super admin</Badge>}
      {user.suspended_at ? (
        <Badge tone="danger">Suspended</Badge>
      ) : isInactive(user) ? (
        <Badge tone="accent">Inactive</Badge>
      ) : (
        <Badge tone="success">Active</Badge>
      )}
    </>
  );
}

// How they sign in: Google, password, or both.
export function signInMethod(user: Pick<AdminUser, "has_google" | "has_password">) {
  if (user.has_google && user.has_password) return "Google + password";
  if (user.has_google) return "Google";
  if (user.has_password) return "Password";
  return "—";
}
