"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Eye, Search, Trash2, Users } from "lucide-react";
import { apiAuthDownload, errorMessage } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import type { AdminUser } from "@/lib/types";
import { unsuspendUser } from "@/services/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Skeleton";
import { MobileList, SortButton, Table, Td, Th } from "@/components/ui/Table";
import { UserStatusBadges, signInMethod } from "@/components/admin/UserStatusBadges";
import { UserAction, UserActionModals } from "@/components/admin/UserActionModals";

type Sort = "newest" | "oldest" | "last_active" | "least_active";

// Every account in one table: contact, plan, profile, groups, last active,
// an on/off switch (suspend / restore), and view / delete.
export default function AdminUsersPage() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [action, setAction] = useState<UserAction>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const filters = new URLSearchParams({ sort, ...(search && { search }), ...(status && { status }) });
  const { data, error: loadError, reload } = usePagedQuery<AdminUser>(`/api/admin/users?${filters}&page=${page}&limit=${limit}`);

  const manageable = (u: AdminUser) => u.role !== "super_admin" && !u.deleted_at;
  const firstRow = data ? (data.pagination.page - 1) * data.pagination.limit : 0;

  function toggleSort(column: "joined" | "active") {
    setPage(1);
    if (column === "joined") setSort(sort === "newest" ? "oldest" : "newest");
    else setSort(sort === "last_active" ? "least_active" : "last_active");
  }

  async function setActive(u: AdminUser, active: boolean) {
    setError(null);
    if (!active) return setAction({ type: "suspend", user: u }); // asks for a reason first
    try {
      await unsuspendUser(u.id);
      reload();
    } catch (err) {
      setError(errorMessage(err, "Couldn't restore the account"));
    }
  }

  async function exportCsv() {
    setError(null);
    setExporting(true);
    try {
      await apiAuthDownload(`/api/admin/users/export?${filters}`, "roomates-users.csv");
    } catch (err) {
      setError(errorMessage(err, "Couldn't export"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={data ? `${data.pagination.total} ${data.pagination.total === 1 ? "account" : "accounts"}` : undefined}
        actions={
          <Button size="sm" onClick={exportCsv} loading={exporting}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <form
          className="flex-1 min-w-60 relative"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(draft.trim());
            setPage(1);
          }}
        >
          <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
          <input
            type="search"
            aria-label="Search users"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Search name, email or mobile, then Enter"
            className="w-full h-11 pl-10 pr-4 rounded-full border border-card-border bg-card text-sm outline-none focus:border-primary"
          />
        </form>
        <div className="w-44">
          <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Everyone</option>
            <option value="active">Active (30 days)</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="deleted">Deleted</option>
          </Select>
        </div>
      </div>
      <FormMessage error={error} />

      {loadError ? (
        <p className="text-danger">{loadError}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="No users match" />
      ) : (
        <Card className="rounded-3xl p-6">
          <Table className="hidden md:block">
            <thead>
              <tr>
                <Th>#</Th>
                <Th>User</Th>
                <Th>Mobile</Th>
                <Th className="hidden 2xl:table-cell">Plan</Th>
                <Th className="hidden 2xl:table-cell">Profile</Th>
                <Th align="right">Groups</Th>
                <Th><SortButton label="Joined" direction={sort === "newest" ? "desc" : sort === "oldest" ? "asc" : null} onClick={() => toggleSort("joined")} /></Th>
                <Th><SortButton label="Last active" direction={sort === "last_active" ? "desc" : sort === "least_active" ? "asc" : null} onClick={() => toggleSort("active")} /></Th>
                <Th>Active</Th>
                <Th align="right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((u, i) => (
                <tr key={u.id} className="hover:bg-foreground/3">
                  <Td className="text-foreground/45 tabular-nums">{firstRow + i + 1}</Td>
                  <Td>
                    <div className="flex items-center gap-3 min-w-56">
                      <Avatar name={u.name} picture={u.picture} size={36} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium">{u.name}</span>
                          <UserStatusBadges user={u} />
                        </div>
                        <p className="text-xs text-foreground/55 truncate max-w-64">{u.deleted_at ? "—" : u.email}</p>
                        <p className="text-xs text-foreground/40">{u.deleted_at ? "" : signInMethod(u)}</p>
                      </div>
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap">{u.phone ?? "—"}</Td>
                  <Td className="hidden 2xl:table-cell"><Badge tone={u.plan === "paid" ? "success" : "neutral"}>{u.plan}</Badge></Td>
                  <Td className="hidden 2xl:table-cell">{u.onboarding_completed ? <Badge tone="success">Yes</Badge> : <Badge tone="accent">No</Badge>}</Td>
                  <Td align="right">{u.room_count}</Td>
                  <Td className="whitespace-nowrap text-foreground/70">{formatDate(u.created_at, "short")}</Td>
                  <Td className="whitespace-nowrap text-foreground/70">{timeAgo(u.last_active_at)}</Td>
                  <Td>
                    <Switch
                      checked={!u.suspended_at}
                      disabled={!manageable(u)}
                      onChange={(on) => setActive(u, on)}
                      label={`${u.name}'s account active`}
                      onText="Active"
                      offText="Off"
                    />
                  </Td>
                  <Td align="right">
                    <div className="inline-flex gap-1">
                      <Link href={`/admin/users/${u.id}`} className="p-2 rounded-full hover:bg-primary/10 text-primary" aria-label={`View ${u.name}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setAction({ type: "delete", user: u })}
                        disabled={!manageable(u)}
                        className="p-2 rounded-full hover:bg-danger/10 text-danger disabled:opacity-30 disabled:hover:bg-transparent"
                        aria-label={`Delete ${u.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Phones: one card per user instead of a 10-column table. */}
          <div className="md:hidden">
            <MobileList>
              {data.items.map((u) => (
                <li key={u.id} className="py-3 flex items-start gap-3">
                  <Avatar name={u.name} picture={u.picture} size={36} />
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary">
                      {u.name}
                    </Link>
                    <div className="flex flex-wrap gap-1.5 my-1">
                      <UserStatusBadges user={u} />
                    </div>
                    <p className="text-xs text-foreground/55 truncate">{u.deleted_at ? "—" : u.email}</p>
                    <p className="text-xs text-foreground/45">
                      Joined {formatDate(u.created_at, "short")} · Active {timeAgo(u.last_active_at)} · {u.room_count} groups
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Switch
                        checked={!u.suspended_at}
                        disabled={!manageable(u)}
                        onChange={(on) => setActive(u, on)}
                        label={`${u.name}'s account active`}
                        onText="Active"
                        offText="Off"
                      />
                      <button
                        onClick={() => setAction({ type: "delete", user: u })}
                        disabled={!manageable(u)}
                        className="p-2 rounded-full hover:bg-danger/10 text-danger disabled:opacity-30"
                        aria-label={`Delete ${u.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </MobileList>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
            <Pagination pagination={data.pagination} onPage={setPage} />
            <div className="w-32 ml-auto pt-4">
              <Select aria-label="Rows per page" value={String(limit)} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}>
                <option value="10">10 / page</option>
                <option value="20">20 / page</option>
                <option value="50">50 / page</option>
              </Select>
            </div>
          </div>
        </Card>
      )}

      <UserActionModals action={action} onClose={() => setAction(null)} onDone={reload} />
    </>
  );
}
