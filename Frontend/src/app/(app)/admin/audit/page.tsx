"use client";

import { useState } from "react";
import { ScrollText } from "lucide-react";
import { usePagedQuery } from "@/lib/useApiQuery";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Skeleton";

interface AuditEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: { reason?: string; note?: string } | null;
  created_at: string;
  admin_name: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  APPROVED_LISTING: "approved a listing",
  REJECTED_LISTING: "rejected a listing",
  REMOVED_LISTING: "took down a listing",
  SUSPENDED_USER: "suspended a user",
  UNSUSPENDED_USER: "restored a user",
  RESOLVED_REPORT: "resolved a report",
  DISMISSED_REPORT: "dismissed a report",
};

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const { data, error } = usePagedQuery<AuditEntry>(`/api/admin/audit-logs?page=${page}&limit=30`);

  return (
    <>
      <PageHeader title="Audit log" subtitle="Every moderation action, who took it and when." />
      {error ? (
        <p className="text-danger">{error}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No actions yet" />
      ) : (
        <Card className="rounded-3xl px-4 sm:px-6 py-2">
          <ul className="divide-y divide-card-border">
            {data.items.map((a) => {
              const why = a.details?.reason ?? a.details?.note;
              return (
                <li key={a.id} className="py-3 text-sm">
                  <p>
                    <span className="font-medium">{a.admin_name ?? "An admin"}</span> {ACTION_LABELS[a.action] ?? a.action}
                    {why && <span className="text-foreground/60"> - &ldquo;{why}&rdquo;</span>}
                  </p>
                  <p className="text-xs text-foreground/45">
                    {new Date(a.created_at).toLocaleString("en-IN")} · {a.entity_type} {a.entity_id.slice(0, 8)}
                  </p>
                </li>
              );
            })}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </>
  );
}
