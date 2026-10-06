"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Inbox, Mail, Phone, Send } from "lucide-react";
import { usePagedQuery } from "@/lib/useApiQuery";
import { rupees, formatDate } from "@/lib/format";
import { REQUEST_STATUS } from "@/lib/listings";
import type { ReceivedRequest, SentRequest } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ReceivedRequestItem } from "@/components/listings/ReceivedRequestItem";
import { LoadingState } from "@/components/ui/Skeleton";

// useSearchParams needs a Suspense boundary for `next build`.
export default function RequestsPage() {
  return (
    <Suspense>
      <Requests />
    </Suspense>
  );
}

function Requests() {
  const [tab, setTab] = useState<"received" | "sent">(useSearchParams().get("tab") === "sent" ? "sent" : "received");
  return (
    <>
      <PageHeader title="Requests" subtitle="People interested in your rooms, and rooms you've asked about." />
      <div className="max-w-sm mb-6">
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: "received", label: "For my rooms" },
            { value: "sent", label: "I sent" },
          ]}
        />
      </div>
      {tab === "received" ? <Received /> : <Sent />}
    </>
  );
}

function Received() {
  const [page, setPage] = useState(1);
  const { data, error, reload } = usePagedQuery<ReceivedRequest>(`/api/requests/received?page=${page}&limit=10`);
  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <LoadingState />;
  if (data.items.length === 0) {
    return (
      <EmptyState icon={<Inbox className="h-6 w-6" />} title="No requests yet">
        When someone is interested in one of your listings, they&apos;ll show up here.
      </EmptyState>
    );
  }
  return (
    <Card className="rounded-3xl px-6 py-2">
      <ul className="divide-y divide-card-border">
        {data.items.map((r) => (
          <ReceivedRequestItem key={r.id} request={r} showListing onChange={reload} />
        ))}
      </ul>
      <Pagination pagination={data.pagination} onPage={setPage} />
    </Card>
  );
}

function Sent() {
  const [page, setPage] = useState(1);
  const { data, error } = usePagedQuery<SentRequest>(`/api/requests/sent?page=${page}&limit=10`);
  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <LoadingState />;
  if (data.items.length === 0) {
    return (
      <EmptyState
        icon={<Send className="h-6 w-6" />}
        title="You haven't asked about any rooms"
        action={
          <Link href="/listings" className="text-primary font-medium">
            Find a room
          </Link>
        }
      />
    );
  }
  return (
    <Card className="rounded-3xl px-6 py-2">
      <ul className="divide-y divide-card-border">
        {data.items.map((r) => {
          const status = REQUEST_STATUS[r.status];
          return (
            <li key={r.id} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/listings/${r.listing_id}`} className="font-medium hover:text-primary">
                  {r.listing_title}
                </Link>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className="text-xs text-foreground/50">
                {r.listing_locality}, {r.listing_city} · {rupees(r.listing_rent_paise)}/month · sent {formatDate(r.created_at, "short")}
              </p>
              {r.status === "accepted" && (
                <div className="mt-2 rounded-xl bg-success/10 px-3 py-2 text-sm">
                  <p className="font-medium">Contact {r.owner_name ?? "the owner"}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    {r.owner_phone && (
                      <a href={`tel:${r.owner_phone}`} className="inline-flex items-center gap-1.5 text-primary">
                        <Phone className="h-3.5 w-3.5" /> {r.owner_phone}
                      </a>
                    )}
                    {r.owner_email && (
                      <a href={`mailto:${r.owner_email}`} className="inline-flex items-center gap-1.5 text-primary break-all">
                        <Mail className="h-3.5 w-3.5" /> {r.owner_email}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Pagination pagination={data.pagination} onPage={setPage} />
    </Card>
  );
}
