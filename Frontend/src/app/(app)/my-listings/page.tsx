"use client";

import { useState } from "react";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { usePagedQuery } from "@/lib/useApiQuery";
import { LISTING_STATUS } from "@/lib/listings";
import type { ListingCard as Listing, ListingStatus } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ListingCard } from "@/components/listings/ListingCard";
import { LoadingState } from "@/components/ui/Skeleton";

// Owner dashboard: every listing I've posted, in any status.
export default function MyListingsPage() {
  const [status, setStatus] = useState<ListingStatus | "">("");
  const [page, setPage] = useState(1);
  const { data, error, loading } = usePagedQuery<Listing>(`/api/listings/mine?page=${page}&limit=12${status ? `&status=${status}` : ""}`);

  return (
    <>
      <PageHeader
        title="My listings"
        subtitle="Rooms you've posted. New and edited listings are reviewed before they go live."
        actions={
          <>
            <Link href="/requests">
              <Button variant="outline" size="sm">
                Requests
              </Button>
            </Link>
            <Link href="/listings/new">
              <Button variant="dark" size="sm">
                <Plus className="h-4 w-4" /> List a room
              </Button>
            </Link>
          </>
        }
      />

      <div className="w-full sm:w-56 mb-6">
        <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value as ListingStatus | ""); setPage(1); }}>
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
      ) : loading && !data ? (
        <LoadingState variant="cards" rows={3} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-6 w-6" />}
          title={status ? "Nothing with this status" : "You haven't listed a room yet"}
          action={
            !status && (
              <Link href="/listings/new">
                <Button variant="dark">
                  <Plus className="h-4 w-4" /> List a room
                </Button>
              </Link>
            )
          }
        >
          {!status && "Have a spare room or need a flatmate? Post it and let people nearby find you."}
        </EmptyState>
      ) : (
        data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {data.items.map((l) => (
                <ListingCard
                  key={l.id}
                  listing={l}
                  showStatus
                  footer={
                    l.status === "rejected" && l.rejection_reason ? (
                      <p className="text-xs text-danger line-clamp-2">Moderator: {l.rejection_reason}</p>
                    ) : l.pending_requests ? (
                      <Link href={`/listings/${l.id}`} className="text-sm text-primary font-medium">
                        {l.pending_requests} new {l.pending_requests === 1 ? "request" : "requests"}
                      </Link>
                    ) : null
                  }
                />
              ))}
            </div>
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>
        )
      )}
    </>
  );
}
