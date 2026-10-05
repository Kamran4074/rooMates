"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, BedDouble, CalendarDays, Flag, Heart, ImageOff, MapPin, Pencil, Sofa, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { rupees, formatDate } from "@/lib/format";
import { useApiQuery, usePagedQuery } from "@/lib/useApiQuery";
import { AMENITY_LABELS, FURNISHING_LABELS, LISTING_STATUS, REPORT_REASON_LABELS, REQUEST_STATUS, ROOM_TYPE_LABELS } from "@/lib/listings";
import type { ListingDetail, ReceivedRequest } from "@/lib/types";
import { changeListingStatus, deleteListing, reportListing, sendInterest } from "@/services/listingsApi";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { FormMessage } from "@/components/ui/FormMessage";
import { Pagination } from "@/components/ui/Pagination";
import { PhotoManager } from "@/components/listings/PhotoManager";
import { ReceivedRequestItem } from "@/components/listings/ReceivedRequestItem";

export default function ListingPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const { data: listing, error, reload } = useApiQuery<ListingDetail>(`/api/listings/${listingId}`);

  if (error) return <p className="text-danger">{error}</p>;
  if (!listing) return <p className="text-foreground/50">Loading...</p>;

  return (
    <>
      <Link
        href={listing.is_mine ? "/my-listings" : "/listings"}
        className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> {listing.is_mine ? "My listings" : "All rooms"}
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Gallery listing={listing} />
          <Card className="rounded-3xl p-6">
            <p className="text-2xl font-semibold">
              {rupees(listing.rent_paise)}
              <span className="text-base font-normal text-foreground/50"> / month</span>
            </p>
            <h1 className="text-xl font-semibold mt-1">{listing.title}</h1>
            <p className="text-sm text-foreground/55 flex items-center gap-1.5 mt-1">
              <MapPin className="h-4 w-4" /> {listing.locality}, {listing.city}, {listing.state} {listing.pincode}
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Badge>
                <BedDouble className="h-3.5 w-3.5 mr-1" /> {ROOM_TYPE_LABELS[listing.room_type]}
              </Badge>
              <Badge>
                <Sofa className="h-3.5 w-3.5 mr-1" /> {FURNISHING_LABELS[listing.furnishing]}
              </Badge>
              <Badge>
                <CalendarDays className="h-3.5 w-3.5 mr-1" /> Available {formatDate(listing.available_from)}
              </Badge>
            </div>
            <p className="mt-5 whitespace-pre-wrap text-foreground/80">{listing.description}</p>
            {listing.amenities.length > 0 && (
              <>
                <h2 className="font-semibold mt-6 mb-2">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((a) => (
                    <Badge key={a} tone="primary">
                      {AMENITY_LABELS[a as keyof typeof AMENITY_LABELS] ?? a}
                    </Badge>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          {listing.is_mine ? <OwnerPanel listing={listing} onChange={reload} /> : <VisitorPanel listing={listing} onChange={reload} />}
        </div>
      </div>
    </>
  );
}

function Gallery({ listing }: { listing: ListingDetail }) {
  const [active, setActive] = useState(0);
  const images = listing.images;
  if (images.length === 0) {
    return (
      <div className="aspect-[16/9] rounded-3xl bg-foreground/5 flex flex-col items-center justify-center text-foreground/40 gap-2">
        <ImageOff className="h-8 w-8" />
        <span className="text-sm">No photos yet</span>
      </div>
    );
  }
  const current = images[Math.min(active, images.length - 1)];
  return (
    <div className="flex flex-col gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted */}
      <img src={current.url} alt={listing.title} className="aspect-[16/9] w-full rounded-3xl object-cover bg-foreground/5" />
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setActive(i)}
              className={`shrink-0 h-16 w-24 rounded-xl overflow-hidden border-2 ${img.id === current.id ? "border-primary" : "border-transparent"}`}
              aria-label={`Photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted */}
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function OwnerPanel({ listing, onChange }: { listing: ListingDetail; onChange: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestPage, setRequestPage] = useState(1);
  const requests = usePagedQuery<ReceivedRequest>(`/api/requests/received?listingId=${listing.id}&page=${requestPage}&limit=10`);
  const status = LISTING_STATUS[listing.status];
  const editable = listing.status !== "removed" && listing.status !== "rented";

  async function run(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      (after ?? onChange)();
      requests.reload();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Card className="rounded-3xl p-6">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="font-semibold">Your listing</h2>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <p className="text-sm text-foreground/60">{status.hint}</p>
        {listing.rejection_reason && (listing.status === "rejected" || listing.status === "removed") && (
          <p className="text-sm mt-3 rounded-xl bg-danger/10 text-danger px-3 py-2">Moderator: {listing.rejection_reason}</p>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          {(listing.status === "draft" || listing.status === "rejected") && (
            <Button size="sm" onClick={() => run(() => changeListingStatus(listing.id, "submit"))} disabled={busy}>
              Submit for review
            </Button>
          )}
          {listing.status === "published" && (
            <Button size="sm" variant="outline" onClick={() => run(() => changeListingStatus(listing.id, "mark_rented"))} disabled={busy}>
              Mark as rented
            </Button>
          )}
          {listing.status === "rented" && (
            <Button size="sm" onClick={() => run(() => changeListingStatus(listing.id, "relist"))} disabled={busy}>
              Relist
            </Button>
          )}
          {editable && (
            <Link href={`/listings/${listing.id}/edit`}>
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            </Link>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            disabled={busy}
            onClick={() =>
              window.confirm("Delete this listing for good? Its photos and requests go too.") &&
              run(() => deleteListing(listing.id), () => router.push("/my-listings"))
            }
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
        <div className="mt-3">
          <FormMessage error={error} />
        </div>
      </Card>

      {editable && (
        <Card className="rounded-3xl p-6">
          <h2 className="font-semibold mb-1">Photos</h2>
          <p className="text-xs text-foreground/50 mb-4">
            Listings with photos get far more interest.{listing.status === "published" && " Changing photos sends it back for review."}
          </p>
          <PhotoManager listingId={listing.id} images={listing.images} onChange={onChange} />
        </Card>
      )}

      <Card className="rounded-3xl p-6">
        <h2 className="font-semibold mb-1">Interested people</h2>
        {requests.error ? (
          <p className="text-danger text-sm">{requests.error}</p>
        ) : !requests.data ? (
          <p className="text-sm text-foreground/50">Loading...</p>
        ) : requests.data.items.length === 0 ? (
          <p className="text-sm text-foreground/55">
            {listing.status === "published" ? "No requests yet." : "Requests appear here once the listing is live."}
          </p>
        ) : (
          <>
            <ul className="divide-y divide-card-border">
              {requests.data.items.map((r) => (
                <ReceivedRequestItem key={r.id} request={r} onChange={() => { requests.reload(); onChange(); }} />
              ))}
            </ul>
            <Pagination pagination={requests.data.pagination} onPage={setRequestPage} />
          </>
        )}
      </Card>
    </>
  );
}

function VisitorPanel({ listing, onChange }: { listing: ListingDetail; onChange: () => void }) {
  const [modal, setModal] = useState<"interest" | "report" | null>(null);
  const [message, setMessage] = useState("");
  const [reason, setReason] = useState<keyof typeof REPORT_REASON_LABELS>("fake_listing");
  const [details, setDetails] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(action: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setModal(null);
      setNotice(done);
      onChange();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong"));
    } finally {
      setBusy(false);
    }
  }

  const requestStatus = listing.my_request_status ? REQUEST_STATUS[listing.my_request_status] : null;

  return (
    <>
      <Card className="rounded-3xl p-6">
        <h2 className="font-semibold mb-1">Interested?</h2>
        {requestStatus ? (
          <>
            <p className="text-sm text-foreground/60 mb-3">You&apos;ve sent a request for this room.</p>
            <Badge tone={requestStatus.tone}>{requestStatus.label}</Badge>
            <p className="text-sm mt-3">
              <Link href="/requests?tab=sent" className="text-primary font-medium">
                See your requests
              </Link>{" "}
              <span className="text-foreground/55">- the owner&apos;s contact appears there once they accept.</span>
            </p>
          </>
        ) : listing.status === "published" ? (
          <>
            <p className="text-sm text-foreground/60 mb-4">
              Send the owner a request. If they accept, you&apos;ll both see each other&apos;s phone and email.
            </p>
            <Button className="w-full" onClick={() => { setError(null); setModal("interest"); }}>
              <Heart className="h-4 w-4" /> I&apos;m interested
            </Button>
          </>
        ) : (
          <p className="text-sm text-foreground/60">This room is no longer available.</p>
        )}
        <div className="mt-3">
          <FormMessage success={notice} />
        </div>
      </Card>

      {listing.status === "published" && (
        <button
          onClick={() => { setError(null); setModal("report"); }}
          className="self-start inline-flex items-center gap-1.5 text-xs text-foreground/45 hover:text-danger"
        >
          <Flag className="h-3.5 w-3.5" /> Report this listing
        </button>
      )}

      <Modal open={modal === "interest"} onClose={() => setModal(null)} title="Message the owner">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => sendInterest(listing.id, message.trim()), "Request sent! You'll see the owner's reply on your Requests page.");
          }}
        >
          <TextArea
            label="Introduce yourself (optional)"
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Working professional, moving in November, non-smoker."
          />
          <FormMessage error={error} />
          <Button type="submit" variant="dark" loading={busy}>
            Send request
          </Button>
        </form>
      </Modal>

      <Modal open={modal === "report"} onClose={() => setModal(null)} title="Report listing">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(() => reportListing(listing.id, reason, details.trim() || undefined), "Thanks - a moderator will take a look.");
          }}
        >
          <Select label="What's wrong?" value={reason} onChange={(e) => setReason(e.target.value as keyof typeof REPORT_REASON_LABELS)}>
            {Object.entries(REPORT_REASON_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <TextArea label="Details (optional)" maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} />
          <FormMessage error={error} />
          <Button type="submit" variant="dark" loading={busy}>
            Send report
          </Button>
        </form>
      </Modal>
    </>
  );
}
