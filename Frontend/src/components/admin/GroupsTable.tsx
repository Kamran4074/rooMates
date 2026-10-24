"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, ChevronRight, Eye } from "lucide-react";
import { formatDate, rupees, timeAgo } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import type { AdminGroup } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { LoadingState } from "@/components/ui/Skeleton";
import { MobileList, SortButton, Table, Td, Th } from "@/components/ui/Table";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { GroupMemberList } from "@/components/admin/GroupMemberList";

type Sort = "newest" | "oldest" | "largest" | "most_spent" | "recent_activity";

const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;

// The "Groups" tab of the admin Users page: every group with who runs it,
// how many people, how much has been spent and when it was last used.
// Expanding a row lists its members; the eye opens the read-only room view.
// The page remounts this with a new `key` when the search changes, which
// also resets paging and open rows.
export function GroupsTable({ search }: { search: string }) {
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const params = new URLSearchParams({ sort, page: String(page), limit: String(limit), ...(search && { search }) });
  const { data, error } = usePagedQuery<AdminGroup>(`/api/admin/rooms?${params}`);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function sortBy(next: Sort) {
    setPage(1);
    // "Created" flips between newest and oldest; the others are biggest-first.
    setSort(next === "newest" && sort === "newest" ? "oldest" : next);
  }
  const dir = (s: Sort) => (sort === s ? "desc" : null);

  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <LoadingState />;
  if (data.items.length === 0) {
    return <EmptyState icon={<Building2 className="h-6 w-6" />} title={search ? "No groups match" : "No groups yet"} />;
  }

  const firstRow = (data.pagination.page - 1) * data.pagination.limit;

  return (
    <Card className="rounded-3xl p-6">
      <Table className="hidden md:block">
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Group</Th>
            <Th>Owner</Th>
            <Th align="right"><SortButton label="People" direction={dir("largest")} onClick={() => sortBy("largest")} /></Th>
            <Th align="right"><SortButton label="Spent" direction={dir("most_spent")} onClick={() => sortBy("most_spent")} /></Th>
            <Th>
              <SortButton
                label="Created"
                direction={sort === "newest" ? "desc" : sort === "oldest" ? "asc" : null}
                onClick={() => sortBy("newest")}
              />
            </Th>
            <Th><SortButton label="Last expense" direction={dir("recent_activity")} onClick={() => sortBy("recent_activity")} /></Th>
            <Th align="right">View</Th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((g, i) => (
            <Fragment key={g.id}>
              <tr className={`hover:bg-foreground/3 ${expanded.has(g.id) ? "bg-foreground/3" : ""}`}>
                <Td className="text-foreground/45 tabular-nums">
                  <button
                    onClick={() => toggleRow(g.id)}
                    aria-expanded={expanded.has(g.id)}
                    aria-label={`${expanded.has(g.id) ? "Hide" : "Show"} the people in ${g.name}`}
                    className="inline-flex items-center gap-1 rounded-lg px-1 -mx-1 hover:bg-foreground/5 hover:text-foreground"
                  >
                    {expanded.has(g.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    {firstRow + i + 1}
                  </button>
                </Td>
                <Td>
                  <div className="flex items-center gap-3 min-w-48">
                    <RoomIcon type={g.type} size="sm" />
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-56">{g.name}</p>
                      <p className="text-xs text-foreground/50">{g.type === "trip" ? "Trip" : "Flat"}</p>
                    </div>
                  </div>
                </Td>
                <Td>
                  {g.owner_id ? (
                    <Link href={`/admin/users/${g.owner_id}`} className="flex items-center gap-2.5 min-w-48 hover:text-primary">
                      <Avatar name={g.owner_name ?? "?"} picture={g.owner_picture} size={30} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{g.owner_name}</p>
                        <p className="text-xs text-foreground/55 truncate max-w-52">{g.owner_email ?? "—"}</p>
                      </div>
                    </Link>
                  ) : (
                    <span className="text-foreground/45">—</span>
                  )}
                </Td>
                <Td align="right" className="whitespace-nowrap">{people(g.member_count)}</Td>
                <Td align="right" className="whitespace-nowrap">
                  <span className="block">{rupees(g.total_spent_paise)}</span>
                  <span className="block text-xs text-foreground/50">
                    {g.expense_count} {g.expense_count === 1 ? "expense" : "expenses"}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-foreground/70">{formatDate(g.created_at, "short")}</Td>
                <Td className="whitespace-nowrap text-foreground/70">{timeAgo(g.last_expense_at, "None yet")}</Td>
                <Td align="right">
                  <Link href={`/admin/rooms/${g.id}`} className="inline-flex p-2 rounded-full hover:bg-primary/10 text-primary" aria-label={`Open ${g.name}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Td>
              </tr>
              {expanded.has(g.id) && (
                <tr>
                  <td colSpan={8} className="px-3 pb-4 border-b border-card-border">
                    <GroupMemberList members={g.members} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </Table>

      {/* Phones: one card per group instead of an 8-column table. */}
      <div className="md:hidden">
        <MobileList>
          {data.items.map((g) => (
            <li key={g.id} className="py-3 flex items-start gap-3">
              <RoomIcon type={g.type} size="sm" />
              <div className="flex-1 min-w-0">
                <Link href={`/admin/rooms/${g.id}`} className="font-medium hover:text-primary">
                  {g.name}
                </Link>
                <p className="text-xs text-foreground/55 truncate">Owner: {g.owner_name ?? "—"}</p>
                <p className="text-xs text-foreground/45">
                  {people(g.member_count)} · {rupees(g.total_spent_paise)} spent · Last expense {timeAgo(g.last_expense_at, "none yet")}
                </p>
                <button
                  onClick={() => toggleRow(g.id)}
                  aria-expanded={expanded.has(g.id)}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary"
                >
                  {expanded.has(g.id) ? "Hide people" : "Show people"}
                  {expanded.has(g.id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                </button>
                {expanded.has(g.id) && (
                  <div className="mt-2">
                    <GroupMemberList members={g.members} />
                  </div>
                )}
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
  );
}
