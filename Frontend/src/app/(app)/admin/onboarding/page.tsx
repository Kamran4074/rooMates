"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, RefreshCw, Search, UserPlus } from "lucide-react";
import { apiAuthGetPaged } from "@/lib/api";
import { formatDate, timeAgo } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import type { OnboardingCounts, OnboardingStage, OnboardingUser } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Skeleton";
import { MobileList, SortButton, Table, Td, Th } from "@/components/ui/Table";

// The funnel every new account goes through. Order matters: a person's
// "current stage" is the first step they haven't done.
const STEPS: { key: Exclude<OnboardingStage, "activated">; label: string; at: keyof OnboardingUser }[] = [
  { key: "email_verified", label: "Verified", at: "email_verified_at" },
  { key: "profile_completed", label: "Profile", at: "onboarding_completed_at" },
  { key: "joined_group", label: "Group", at: "joined_group_at" },
  { key: "first_expense", label: "First expense", at: "first_expense_at" },
];
const STAGE_LABEL: Record<OnboardingStage, string> = {
  email_verified: "Verify email",
  profile_completed: "Profile",
  joined_group: "Join a group",
  first_expense: "First expense",
  activated: "Activated",
};

type Filter = "all" | "stuck" | "activated" | "dormant" | `waiting_${Exclude<OnboardingStage, "activated">}`;
type Sort = "newest" | "oldest" | "waiting_longest" | "waiting_shortest";

const TABS: { key: Filter; label: string; count: (c: OnboardingCounts) => number }[] = [
  { key: "all", label: "All", count: (c) => c.signed_up },
  { key: "stuck", label: "Stuck 3+ days", count: (c) => c.stuck },
  { key: "waiting_email_verified", label: "Waiting: email", count: (c) => c.waiting_email_verified },
  { key: "waiting_profile_completed", label: "Waiting: profile", count: (c) => c.waiting_profile_completed },
  { key: "waiting_joined_group", label: "Waiting: group", count: (c) => c.waiting_joined_group },
  { key: "waiting_first_expense", label: "Waiting: first expense", count: (c) => c.waiting_first_expense },
  { key: "activated", label: "Activated", count: (c) => c.activated },
  { key: "dormant", label: "Dormant 30+ days", count: (c) => c.dormant },
];

function FunnelCard({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div className="rounded-2xl bg-foreground/3 p-4 flex flex-col gap-2">
      <p className="text-xs text-foreground/55">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      <ProgressBar value={value} max={total} />
      <p className="text-xs text-foreground/45">
        {percent}% of signups{value < total && <span className="text-danger"> · {value - total}</span>}
      </p>
    </div>
  );
}

// A step's cell: done (✓ + date), the step they're on now (clock), or not reached yet (—).
function StepCell({ user, step }: { user: OnboardingUser; step: (typeof STEPS)[number] }) {
  const at = user[step.at] as string | null;
  if (at) {
    return (
      <span className="inline-flex flex-col items-center gap-0.5 text-xs text-foreground/60">
        <CheckCircle2 className="h-4 w-4 text-success" aria-label="Done" />
        {formatDate(at, "short")}
      </span>
    );
  }
  if (user.stage === step.key) return <Clock className="h-4 w-4 text-accent mx-auto" aria-label="Waiting" />;
  return <span className="text-foreground/30">—</span>;
}

function StageBadge({ user }: { user: OnboardingUser }) {
  return (
    <Badge tone={user.stage === "activated" ? "success" : "accent"}>
      {user.stage === "activated" ? "" : "Waiting: "}
      {STAGE_LABEL[user.stage]}
    </Badge>
  );
}

export default function OnboardingTrackerPage() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const params = new URLSearchParams({ filter, sort, page: String(page), limit: String(limit), ...(search && { search }) });
  const { data, error, loading, reload } = useApiQuery(
    `/api/admin/onboarding?${params}`,
    "",
    apiAuthGetPaged<{ counts: OnboardingCounts; items: OnboardingUser[] }>
  );

  const counts = data?.data.counts;
  const items = data?.data.items ?? [];

  return (
    <>
      <PageHeader title="Onboarding tracker" subtitle="Where each new account is in getting started, and who's stuck." />

      {error ? (
        <p className="text-danger">{error}</p>
      ) : !counts ? (
        <LoadingState variant="page" />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            <FunnelCard label="Signed up" value={counts.signed_up} total={counts.signed_up} />
            <FunnelCard label="Email verified" value={counts.email_verified} total={counts.signed_up} />
            <FunnelCard label="Profile done" value={counts.profile_completed} total={counts.signed_up} />
            <FunnelCard label="In a group" value={counts.joined_group} total={counts.signed_up} />
            <FunnelCard label="First expense" value={counts.first_expense} total={counts.signed_up} />
          </div>

          <div className="flex gap-1 overflow-x-auto mb-4 -mx-1 px-1 pb-1" role="tablist" aria-label="Filter by stage">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={filter === t.key}
                onClick={() => { setFilter(t.key); setPage(1); }}
                className={`h-9 px-4 rounded-full text-sm whitespace-nowrap ${
                  filter === t.key ? "bg-foreground text-background font-medium" : "text-foreground/65 hover:bg-foreground/5"
                }`}
              >
                {t.label} ({t.count(counts)})
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <form
              className="flex-1 relative"
              onSubmit={(e) => {
                e.preventDefault();
                setSearch(draft.trim());
                setPage(1);
              }}
            >
              <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none" />
              <input
                type="search"
                aria-label="Search people"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Search name, email or mobile, then Enter"
                className="w-full h-11 pl-10 pr-4 rounded-full border border-card-border bg-card text-sm outline-none focus:border-primary"
              />
            </form>
            <button
              onClick={reload}
              className="h-11 w-11 shrink-0 inline-flex items-center justify-center rounded-full border border-card-border hover:bg-foreground/5"
              aria-label="Refresh"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {items.length === 0 ? (
            <EmptyState icon={<UserPlus className="h-6 w-6" />} title="Nobody here" />
          ) : (
            <Card className="rounded-3xl p-6">
              <Table className="hidden md:block">
                <thead>
                  <tr>
                    <Th>Person</Th>
                    <Th>
                      <SortButton label="Signed up" direction={sort === "newest" ? "desc" : sort === "oldest" ? "asc" : null} onClick={() => { setSort(sort === "newest" ? "oldest" : "newest"); setPage(1); }} />
                    </Th>
                    {STEPS.map((s) => (
                      <Th key={s.key}>{s.label}</Th>
                    ))}
                    <Th>Stage</Th>
                    <Th>
                      <SortButton
                        label="Waiting"
                        direction={sort === "waiting_longest" ? "desc" : sort === "waiting_shortest" ? "asc" : null}
                        onClick={() => { setSort(sort === "waiting_longest" ? "waiting_shortest" : "waiting_longest"); setPage(1); }}
                      />
                    </Th>
                    <Th className="hidden 2xl:table-cell">Mobile</Th>
                    <Th className="hidden 2xl:table-cell">Last active</Th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} className="hover:bg-foreground/3">
                      <Td>
                        <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 min-w-44 group">
                          <Avatar name={u.name} picture={u.picture} size={32} />
                          <span className="min-w-0">
                            <span className="block font-medium group-hover:text-primary">{u.name}</span>
                            <span className="block text-xs text-foreground/55 truncate max-w-48">{u.email}</span>
                          </span>
                        </Link>
                      </Td>
                      <Td className="text-center">
                        <span className="inline-flex flex-col items-center gap-0.5 text-xs text-foreground/60">
                          <CheckCircle2 className="h-4 w-4 text-success" aria-label="Done" />
                          {formatDate(u.created_at, "short")}
                        </span>
                      </Td>
                      {STEPS.map((s) => (
                        <Td key={s.key} className="text-center">
                          <StepCell user={u} step={s} />
                        </Td>
                      ))}
                      <Td><StageBadge user={u} /></Td>
                      <Td align="right">{u.days_waiting === null ? "—" : `${u.days_waiting} ${u.days_waiting === 1 ? "day" : "days"}`}</Td>
                      <Td className="whitespace-nowrap hidden 2xl:table-cell">{u.phone ?? "—"}</Td>
                      <Td className="whitespace-nowrap text-foreground/60 hidden 2xl:table-cell">{timeAgo(u.last_active_at)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="md:hidden">
                <MobileList>
                  {items.map((u) => (
                    <li key={u.id} className="py-3 flex items-start gap-3">
                      <Avatar name={u.name} picture={u.picture} size={32} />
                      <div className="flex-1 min-w-0">
                        <Link href={`/admin/users/${u.id}`} className="font-medium hover:text-primary">
                          {u.name}
                        </Link>
                        <p className="text-xs text-foreground/55 truncate">{u.email}</p>
                        <div className="flex flex-wrap items-center gap-2 my-1.5">
                          <StageBadge user={u} />
                          {u.days_waiting !== null && <span className="text-xs text-foreground/55">{u.days_waiting} days waiting</span>}
                        </div>
                        <p className="text-xs text-foreground/45">
                          Signed up {formatDate(u.created_at, "short")} · Active {timeAgo(u.last_active_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </MobileList>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
                {data && <Pagination pagination={data.pagination} onPage={setPage} />}
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
        </>
      )}
    </>
  );
}
