"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import { suspendUser, unsuspendUser } from "@/services/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Pagination } from "@/components/ui/Pagination";
import { ReasonModal } from "@/components/admin/ReasonModal";
import { LoadingState } from "@/components/ui/Skeleton";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: "user" | "super_admin";
  suspended_at: string | null;
  created_at: string;
  listing_count: number;
  room_count: number;
}

export default function AdminUsersPage() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [suspended, setSuspended] = useState("");
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const query = new URLSearchParams({ page: String(page), limit: "20", ...(search && { search }), ...(suspended && { suspended }) });
  const { data, error: loadError, reload } = usePagedQuery<AdminUser>(`/api/admin/users?${query}`);

  async function restore(user: AdminUser) {
    setError(null);
    try {
      await unsuspendUser(user.id);
      reload();
    } catch (err) {
      setError(errorMessage(err, "Couldn't restore the account"));
    }
  }

  return (
    <>
      <PageHeader title="Users" />
      <form
        className="flex flex-wrap items-end gap-3 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <div className="flex-1 min-w-56">
          <TextField label="Search" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Name, email or phone" />
        </div>
        <div className="w-44">
          <Select label="Status" value={suspended} onChange={(e) => { setSuspended(e.target.value); setPage(1); }}>
            <option value="">Everyone</option>
            <option value="false">Active</option>
            <option value="true">Suspended</option>
          </Select>
        </div>
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>
      <FormMessage error={error} />

      {loadError ? (
        <p className="text-danger">{loadError}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No users match" />
      ) : (
        <Card className="rounded-3xl px-4 sm:px-6 py-2">
          <ul className="divide-y divide-card-border">
            {data.items.map((u) => (
              <li key={u.id} className="py-3 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-52">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{u.name}</span>
                    {u.role === "super_admin" && <Badge tone="primary">Admin</Badge>}
                    {u.suspended_at && <Badge tone="danger">Suspended</Badge>}
                  </div>
                  <p className="text-xs text-foreground/55 break-all">
                    {u.email}
                    {u.phone && ` · ${u.phone}`}
                  </p>
                  <p className="text-xs text-foreground/45">
                    Joined {formatDate(u.created_at, "short")} · {u.room_count} rooms · {u.listing_count} listings
                  </p>
                </div>
                {u.role !== "super_admin" &&
                  (u.suspended_at ? (
                    <Button size="sm" variant="outline" onClick={() => restore(u)}>
                      Restore
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-danger" onClick={() => setSuspending(u)}>
                      Suspend
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}

      <ReasonModal
        open={!!suspending}
        title={`Suspend ${suspending?.name ?? ""}`}
        label="Reason (kept in the audit log)"
        confirmLabel="Suspend and sign them out"
        required={false}
        onClose={() => setSuspending(null)}
        onConfirm={async (reason) => {
          await suspendUser(suspending!.id, reason || undefined);
          reload();
        }}
      />
    </>
  );
}
