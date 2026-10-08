"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import { formatDate, timeAgo } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import type { AdminUser } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Skeleton";
import { UserStatusBadges, signInMethod } from "@/components/admin/UserStatusBadges";

// Every account at a glance: when they joined, when they last used the app,
// how many groups they're in. Click one to manage it.
export default function AdminUsersPage() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const query = new URLSearchParams({ page: String(page), limit: "20", sort, ...(search && { search }), ...(status && { status }) });
  const { data, error } = usePagedQuery<AdminUser>(`/api/admin/users?${query}`);

  return (
    <>
      <PageHeader title="Users" subtitle={data ? `${data.pagination.total} ${data.pagination.total === 1 ? "account" : "accounts"}` : undefined} />
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
        <div className="w-40">
          <Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Everyone</option>
            <option value="active">Active (30 days)</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </Select>
        </div>
        <div className="w-40">
          <Select label="Sort" value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="last_active">Last active</option>
          </Select>
        </div>
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>

      {error ? (
        <p className="text-danger">{error}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No users match" />
      ) : (
        <Card className="rounded-3xl px-2 sm:px-4 py-2">
          <ul className="divide-y divide-card-border">
            {data.items.map((u) => (
              <li key={u.id}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-2 py-3 rounded-2xl hover:bg-foreground/3">
                  <Avatar name={u.name} picture={u.picture} size={36} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium truncate">{u.name}</span>
                      <UserStatusBadges user={u} />
                    </div>
                    <p className="text-xs text-foreground/55 truncate">
                      {u.deleted_at ? `Deleted ${formatDate(u.deleted_at, "short")}` : u.email}
                      {u.phone && ` · ${u.phone}`}
                    </p>
                    <p className="text-xs text-foreground/45">
                      Joined {formatDate(u.created_at, "short")} · Last active {timeAgo(u.last_active_at)} · {u.room_count}{" "}
                      {u.room_count === 1 ? "group" : "groups"}
                      {u.listing_count > 0 && ` · ${u.listing_count} listings`}
                      {!u.deleted_at && ` · ${signInMethod(u)}`}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-foreground/30 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </>
  );
}
