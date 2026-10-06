"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import { LISTING_STATUS, REPORT_REASON_LABELS } from "@/lib/listings";
import type { ListingStatus } from "@/lib/types";
import { resolveReport } from "@/services/adminApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { FormMessage } from "@/components/ui/FormMessage";
import { Pagination } from "@/components/ui/Pagination";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { LoadingState } from "@/components/ui/Skeleton";

interface Report {
  id: string;
  reason: keyof typeof REPORT_REASON_LABELS;
  description: string | null;
  status: "open" | "resolved" | "dismissed";
  created_at: string;
  resolved_at: string | null;
  listing_id: string;
  listing_title: string;
  listing_status: ListingStatus;
  reported_by_name: string | null;
  resolved_by_name: string | null;
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<"open" | "resolved" | "dismissed">("open");
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const { data, error: loadError, reload } = usePagedQuery<Report>(`/api/admin/reports?status=${status}&page=${page}&limit=20`);

  async function act(id: string, action: "dismiss" | "resolve" | "remove_listing") {
    if (
      action === "remove_listing" &&
      !(await confirm({
        title: "Take this listing down?",
        message: "It disappears from search, and every open report on it is marked resolved.",
        confirmLabel: "Take down",
        danger: true,
      }))
    ) {
      return;
    }
    setError(null);
    try {
      await resolveReport(id, action);
      reload();
    } catch (err) {
      setError(errorMessage(err, "Couldn't update the report"));
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Listings that users flagged." />
      <div className="max-w-md mb-6">
        <SegmentedControl
          value={status}
          onChange={(s) => { setStatus(s); setPage(1); }}
          options={[
            { value: "open", label: "Open" },
            { value: "resolved", label: "Resolved" },
            { value: "dismissed", label: "Dismissed" },
          ]}
        />
      </div>
      <FormMessage error={error} />

      {loadError ? (
        <p className="text-danger">{loadError}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Flag className="h-6 w-6" />} title={status === "open" ? "No open reports" : "Nothing here"} />
      ) : (
        <Card className="rounded-3xl px-4 sm:px-6 py-2">
          <ul className="divide-y divide-card-border">
            {data.items.map((r) => (
              <li key={r.id} className="py-4 flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{REPORT_REASON_LABELS[r.reason]}</Badge>
                  <Link href={`/admin/listings/${r.listing_id}`} className="font-medium hover:text-primary">
                    {r.listing_title}
                  </Link>
                  <Badge tone={LISTING_STATUS[r.listing_status].tone}>{LISTING_STATUS[r.listing_status].label}</Badge>
                </div>
                {r.description && <p className="text-sm text-foreground/75">{r.description}</p>}
                <p className="text-xs text-foreground/50">
                  By {r.reported_by_name ?? "a user"} · {formatDate(r.created_at, "short")}
                  {r.resolved_by_name && ` · handled by ${r.resolved_by_name}`}
                </p>
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => act(r.id, "dismiss")}>
                      Dismiss
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => act(r.id, "resolve")}>
                      Mark resolved
                    </Button>
                    {r.listing_status !== "removed" && (
                      <Button size="sm" variant="ghost" className="text-danger" onClick={() => act(r.id, "remove_listing")}>
                        Take listing down
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </>
  );
}
