"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, MapPin, X, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { rupees, formatDate } from "@/lib/format";
import { useApiQuery } from "@/lib/useApiQuery";
import { AMENITY_LABELS, FURNISHING_LABELS, LISTING_STATUS, REPORT_REASON_LABELS, ROOM_TYPE_LABELS } from "@/lib/listings";
import type { ListingDetail } from "@/lib/types";
import { approveListing, rejectListing, removeListing } from "@/services/adminApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { ReasonModal } from "@/components/admin/ReasonModal";

interface AdminListing extends Omit<ListingDetail, "is_mine"> {
  owner: { id: string; name: string; email: string; phone: string | null; suspended_at: string | null };
  reports: { id: string; reason: keyof typeof REPORT_REASON_LABELS; description: string | null; status: string; created_at: string; reported_by_name: string | null }[];
}

export default function AdminListingPage() {
  const { id } = useParams<{ id: string }>();
  const { data: l, error, reload } = useApiQuery<AdminListing>(`/api/admin/listings/${id}`);
  const [modal, setModal] = useState<"reject" | "remove" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function approve() {
    setBusy(true);
    setActionError(null);
    try {
      await approveListing(id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err, "Couldn't approve"));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="text-danger">{error}</p>;
  if (!l) return <p className="text-foreground/50">Loading...</p>;
  const status = LISTING_STATUS[l.status];

  return (
    <>
      <Link href="/admin/listings" className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Listings
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 rounded-3xl p-6">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Badge tone={status.tone}>{status.label}</Badge>
            <span className="text-xs text-foreground/50">Updated {formatDate(l.updated_at)}</span>
          </div>
          <h1 className="text-xl font-semibold">{l.title}</h1>
          <p className="text-lg font-semibold mt-1">{rupees(l.rent_paise)} / month</p>
          <p className="text-sm text-foreground/55 flex items-center gap-1.5 mt-1">
            <MapPin className="h-4 w-4" /> {l.locality}, {l.city}, {l.state} {l.pincode}
            {l.latitude !== null && ` · pinned at ${l.latitude}, ${l.longitude}`}
          </p>
          <p className="text-sm text-foreground/55 mt-1">
            {ROOM_TYPE_LABELS[l.room_type]} · {FURNISHING_LABELS[l.furnishing]} · available {formatDate(l.available_from)}
          </p>
          {l.images.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
              {l.images.map((img) => (
                // eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted
                <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer"><img src={img.url} alt="" className="aspect-[4/3] w-full rounded-xl object-cover" /></a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-foreground/50 mt-4">No photos.</p>
          )}
          <p className="mt-4 whitespace-pre-wrap text-foreground/80">{l.description}</p>
          {l.amenities.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {l.amenities.map((a) => (
                <Badge key={a}>{AMENITY_LABELS[a as keyof typeof AMENITY_LABELS] ?? a}</Badge>
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold mb-3">Moderation</h2>
            <div className="flex flex-wrap gap-2">
              {l.status === "pending" && (
                <>
                  <Button size="sm" onClick={approve} loading={busy}>
                    <Check className="h-4 w-4" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setModal("reject")}>
                    <X className="h-4 w-4" /> Reject
                  </Button>
                </>
              )}
              {l.status !== "removed" && (
                <Button size="sm" variant="ghost" className="text-danger" onClick={() => setModal("remove")}>
                  <Trash2 className="h-4 w-4" /> Take down
                </Button>
              )}
            </div>
            {l.rejection_reason && <p className="text-sm mt-3 text-foreground/60">Last reason: {l.rejection_reason}</p>}
            <div className="mt-3">
              <FormMessage error={actionError} />
            </div>
          </Card>

          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold mb-2">Owner</h2>
            <p className="font-medium">{l.owner.name}</p>
            <p className="text-sm text-foreground/60 break-all">{l.owner.email}</p>
            {l.owner.phone && <p className="text-sm text-foreground/60">{l.owner.phone}</p>}
            {l.owner.suspended_at && <Badge tone="danger">Suspended</Badge>}
          </Card>

          <Card className="rounded-3xl p-6">
            <h2 className="font-semibold mb-2">Reports ({l.reports.length})</h2>
            {l.reports.length === 0 ? (
              <p className="text-sm text-foreground/55">None.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {l.reports.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-medium">{REPORT_REASON_LABELS[r.reason]}</span>{" "}
                    <Badge tone={r.status === "open" ? "danger" : "neutral"}>{r.status}</Badge>
                    <p className="text-xs text-foreground/50">
                      {r.reported_by_name ?? "A user"} · {formatDate(r.created_at, "short")}
                    </p>
                    {r.description && <p className="text-foreground/70 mt-0.5">{r.description}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ReasonModal
        open={modal === "reject"}
        title="Reject listing"
        label="What should the owner fix? (they'll see this)"
        confirmLabel="Reject"
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          await rejectListing(id, reason);
          reload();
        }}
      />
      <ReasonModal
        open={modal === "remove"}
        title="Take down listing"
        label="Reason (shown to the owner, kept in the audit log)"
        confirmLabel="Take down"
        onClose={() => setModal(null)}
        onConfirm={async (reason) => {
          await removeListing(id, reason);
          reload();
        }}
      />
    </>
  );
}
