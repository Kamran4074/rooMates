"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ImageOff, Inbox } from "lucide-react";
import { usePagedQuery } from "@/lib/useApiQuery";
import { rupees, formatDate } from "@/lib/format";
import { LISTING_STATUS } from "@/lib/listings";
import type { ListingStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { LoadingState } from "@/components/ui/Skeleton";

interface AdminListingRow {
  id: string;
  title: string;
  city: string;
  locality: string;
  rent_paise: number;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  owner_name: string;
  owner_email: string;
  open_reports: number;
  cover_url: string | null;
}

export default function AdminListingsPage() {
  return (
    <Suspense>
      <AdminListings />
    </Suspense>
  );
}

function AdminListings() {
  const initial = useSearchParams().get("status");
  const [status, setStatus] = useState<ListingStatus | "">((initial as ListingStatus) ?? "pending");
  const [page, setPage] = useState(1);
  const { data, error } = usePagedQuery<AdminListingRow>(`/api/admin/listings?page=${page}&limit=20${status ? `&status=${status}` : ""}`);

  return (
    <>
      <PageHeader title="Listings" subtitle={status === "pending" ? "The review queue, oldest first." : "Every listing on the platform."} />
      <div className="w-full sm:w-56 mb-6">
        <Select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value as ListingStatus | ""); setPage(1); }}>
          <option value="">All statuses</option>
          {Object.entries(LISTING_STATUS).map(([v, s]) => (
            <option key={v} value={v}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {error ? (
        <p className="text-danger">{error}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Inbox className="h-6 w-6" />} title={status === "pending" ? "Queue is empty" : "No listings"}>
          {status === "pending" && "Nothing is waiting for review."}
        </EmptyState>
      ) : (
        <Card className="rounded-3xl px-4 sm:px-6 py-2">
          <ul className="divide-y divide-card-border">
            {data.items.map((l) => {
              const s = LISTING_STATUS[l.status];
              return (
                <li key={l.id}>
                  <Link href={`/admin/listings/${l.id}`} className="py-3 flex items-center gap-3 hover:opacity-80">
                    <div className="h-14 w-20 shrink-0 rounded-xl overflow-hidden bg-foreground/5 flex items-center justify-center text-foreground/30">
                      {l.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted
                        <img src={l.cover_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ImageOff className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{l.title}</p>
                      <p className="text-xs text-foreground/50 truncate">
                        {l.locality}, {l.city} · {rupees(l.rent_paise)}/mo · {l.owner_name} · {formatDate(l.updated_at, "short")}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge tone={s.tone}>{s.label}</Badge>
                      {l.open_reports > 0 && <Badge tone="danger">{l.open_reports} reports</Badge>}
                    </div>
                  </Link>
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
