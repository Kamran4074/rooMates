"use client";

import Link from "next/link";
import { Building2, Clock, Flag, Home, Megaphone, UserX, Users, CheckCircle2 } from "lucide-react";
import { useApiQuery } from "@/lib/useApiQuery";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { LoadingState } from "@/components/ui/Skeleton";

interface Stats {
  total_users: number;
  suspended_users: number;
  listing_owners: number;
  total_listings: number;
  pending_listings: number;
  published_listings: number;
  open_reports: number;
  total_rooms: number;
}

export default function AdminOverviewPage() {
  const { data: s, error } = useApiQuery<Stats>("/api/admin/stats");
  if (error) return <p className="text-danger">{error}</p>;
  if (!s) return <LoadingState variant="page" />;

  return (
    <>
      <PageHeader title="Admin" subtitle="Moderate listings, handle reports and manage accounts." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/listings?status=pending">
          <StatCard icon={<Clock className="h-4 w-4" />} tone="accent" label="Waiting for review" value={String(s.pending_listings)} hint="Open the queue" />
        </Link>
        <Link href="/admin/reports">
          <StatCard icon={<Flag className="h-4 w-4" />} tone="danger" label="Open reports" value={String(s.open_reports)} />
        </Link>
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} tone="success" label="Live listings" value={String(s.published_listings)} />
        <StatCard icon={<Megaphone className="h-4 w-4" />} tone="primary" label="All listings" value={String(s.total_listings)} />
        <StatCard icon={<Users className="h-4 w-4" />} tone="primary" label="Users" value={String(s.total_users)} />
        <StatCard icon={<Home className="h-4 w-4" />} tone="primary" label="Listing owners" value={String(s.listing_owners)} />
        <StatCard icon={<UserX className="h-4 w-4" />} tone="danger" label="Suspended" value={String(s.suspended_users)} />
        <StatCard icon={<Building2 className="h-4 w-4" />} tone="accent" label="Expense rooms" value={String(s.total_rooms)} />
      </div>
    </>
  );
}
