"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronRight, ShieldOff, ShieldCheck, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatDate, rupees, timeAgo } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import type { AdminUserDetail } from "@/lib/types";
import { deleteUser, suspendUser, unsuspendUser } from "@/services/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { FormMessage } from "@/components/ui/FormMessage";
import { LoadingState } from "@/components/ui/Skeleton";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { ReasonModal } from "@/components/admin/ReasonModal";
import { UserStatusBadges, signInMethod } from "@/components/admin/UserStatusBadges";

const ACTION_LABELS: Record<string, string> = {
  SUSPENDED_USER: "Suspended",
  UNSUSPENDED_USER: "Restored",
  DELETED_USER: "Deleted",
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-foreground/50">{label}</p>
      <p className="text-sm font-medium break-words">{children}</p>
    </div>
  );
}

export default function AdminUserPage() {
  const { id } = useParams<{ id: string }>();
  const { data: u, error, reload } = useApiQuery<AdminUserDetail>(`/api/admin/users/${id}`);
  const [modal, setModal] = useState<"suspend" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <p className="text-danger">{error}</p>;
  if (!u) return <LoadingState variant="page" />;

  const manageable = u.role !== "super_admin" && !u.deleted_at;

  async function restore() {
    setActionError(null);
    try {
      await unsuspendUser(u!.id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't restore the account"));
    }
  }

  return (
    <>
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3 min-w-0">
            <Avatar name={u.name} picture={u.picture} size={40} />
            <span className="truncate">{u.name}</span>
          </span>
        }
        actions={
          manageable && (
            <>
              {u.suspended_at ? (
                <Button size="sm" variant="outline" onClick={restore}>
                  <ShieldCheck className="h-4 w-4" /> Restore
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setModal("suspend")}>
                  <ShieldOff className="h-4 w-4" /> Suspend
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => setModal("delete")}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )
        }
      />
      <div className="flex flex-wrap gap-2 mb-6 -mt-2">
        <UserStatusBadges user={u} />
      </div>
      <FormMessage error={actionError} />

      <Card className="rounded-3xl p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <Fact label="Email">{u.deleted_at ? "—" : u.email}</Fact>
          <Fact label="Phone">{u.phone ?? "—"}</Fact>
          <Fact label="Joined">{formatDate(u.created_at)}</Fact>
          <Fact label="Last active">{timeAgo(u.last_active_at)}</Fact>
          <Fact label="Signs in with">{signInMethod(u)}</Fact>
          <Fact label="Signed-in devices">{u.active_sessions}</Fact>
          <Fact label="Plan">
            {u.plan} · up to {u.max_rooms} rooms
          </Fact>
          <Fact label="Email verified">{u.email_verified ? "Yes" : "No"}</Fact>
          {u.suspended_at && <Fact label="Suspended on">{formatDate(u.suspended_at)}</Fact>}
          {u.deleted_at && <Fact label="Deleted on">{formatDate(u.deleted_at)}</Fact>}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl p-6">
          <h2 className="font-semibold mb-4">
            Groups <span className="text-foreground/45 font-normal">({u.rooms.length})</span>
          </h2>
          {u.rooms.length === 0 ? (
            <p className="text-sm text-foreground/55">Not in any group.</p>
          ) : (
            <ul className="divide-y divide-card-border">
              {u.rooms.map((r) => (
                <li key={r.id}>
                  <Link href={`/admin/rooms/${r.id}`} className="flex items-center gap-3 py-3 hover:bg-foreground/3 rounded-2xl px-2 -mx-2">
                    <RoomIcon type={r.type} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {r.name} {r.role === "admin" && <Badge tone="primary">Room admin</Badge>}
                      </p>
                      <p className="text-xs text-foreground/50">
                        {r.member_count} {r.member_count === 1 ? "member" : "members"} · joined {formatDate(r.joined_at, "short")}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${r.net_paise > 0 ? "text-success" : r.net_paise < 0 ? "text-danger" : "text-foreground/50"}`}>
                      {r.net_paise === 0 ? "Settled" : `${r.net_paise > 0 ? "is owed" : "owes"} ${rupees(r.net_paise)}`}
                    </span>
                    <ChevronRight className="h-4 w-4 text-foreground/30 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold mb-4">Listings</h2>
            {u.listings.length === 0 ? (
              <p className="text-sm text-foreground/55">No listings.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {u.listings.map((l) => (
                  <li key={l.id}>
                    <Link href={`/admin/listings/${l.id}`} className="flex items-center gap-2 text-sm hover:text-primary">
                      <span className="flex-1 truncate">{l.title}</span>
                      <Badge>{l.status}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold mb-4">Admin history</h2>
            {u.history.length === 0 ? (
              <p className="text-sm text-foreground/55">No admin actions on this account.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {u.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <p>
                      <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
                      <span className="text-foreground/50"> by {h.admin_name ?? "an admin"} · {formatDate(h.created_at, "short")}</span>
                    </p>
                    {typeof h.details?.reason === "string" && <p className="text-xs text-foreground/55">“{h.details.reason}”</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ReasonModal
        open={modal === "suspend"}
        title={`Suspend ${u.name}`}
        label="Reason (kept in the audit log)"
        confirmLabel="Suspend and sign them out"
        required={false}
        description="They're signed out everywhere and can't sign in until you restore the account. Nothing is deleted."
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          await suspendUser(u.id, reason || undefined);
          reload();
        }}
      />
      <ReasonModal
        open={modal === "delete"}
        title={`Delete ${u.name}?`}
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
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          await deleteUser(u.id, reason);
          reload();
        }}
      />
    </>
  );
}
