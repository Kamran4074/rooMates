"use client";

import Link from "next/link";
import { Activity, Building2, CheckCircle2, Clock, Flag, Megaphone, Receipt, UserPlus, UserX, Users } from "lucide-react";
import { useApiQuery } from "@/lib/useApiQuery";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/Skeleton";

interface Stats {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_users_7d: number;
  active_users_30d: number;
  suspended_users: number;
  deleted_users: number;
  total_rooms: number;
  avg_room_size: number;
  total_expenses: number;
  listing_owners: number;
  total_listings: number;
  pending_listings: number;
  published_listings: number;
  open_reports: number;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-semibold text-foreground/60 mb-3">{title}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </section>
  );
}

export default function AdminOverviewPage() {
  const { data: s, error } = useApiQuery<Stats>("/api/admin/stats");
  if (error) return <p className="text-danger">{error}</p>;
  if (!s) return <LoadingState variant="page" />;

  return (
    <>
      <PageHeader title="Admin" subtitle="Accounts, groups, listings and reports in one place." />

      <Section title="People">
        <Link href="/admin/users">
          <StatCard icon={<Users className="h-4 w-4" />} tone="primary" label="Accounts" value={String(s.total_users)} hint="Manage users" />
        </Link>
        <Link href="/admin/users?sort=newest">
          <StatCard icon={<UserPlus className="h-4 w-4" />} tone="success" label="New this week" value={String(s.new_users_7d)} hint={`${s.new_users_30d} in 30 days`} />
        </Link>
        <StatCard icon={<Activity className="h-4 w-4" />} tone="accent" label="Active this week" value={String(s.active_users_7d)} hint={`${s.active_users_30d} in 30 days`} />
        <StatCard icon={<UserX className="h-4 w-4" />} tone="danger" label="Suspended" value={String(s.suspended_users)} hint={`${s.deleted_users} deleted`} />
      </Section>

      <Section title="Groups">
        <Link href="/admin/rooms">
          <StatCard icon={<Building2 className="h-4 w-4" />} tone="primary" label="Groups" value={String(s.total_rooms)} hint={`${s.avg_room_size} people on average`} />
        </Link>
        <StatCard icon={<Receipt className="h-4 w-4" />} tone="accent" label="Expenses recorded" value={String(s.total_expenses)} />
      </Section>

      <Section title="Listings">
        <Link href="/admin/listings?status=pending">
          <StatCard icon={<Clock className="h-4 w-4" />} tone="accent" label="Waiting for review" value={String(s.pending_listings)} hint="Open the queue" />
        </Link>
        <Link href="/admin/reports">
          <StatCard icon={<Flag className="h-4 w-4" />} tone="danger" label="Open reports" value={String(s.open_reports)} />
        </Link>
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} tone="success" label="Live listings" value={String(s.published_listings)} />
        <StatCard icon={<Megaphone className="h-4 w-4" />} tone="primary" label="All listings" value={String(s.total_listings)} hint={`${s.listing_owners} owners`} />
      </Section>
    </>
  );
}
