"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useApiQuery } from "@/lib/useApiQuery";
import type { ListingDetail } from "@/lib/types";
import { updateListing } from "@/services/listingsApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListingForm } from "@/components/listings/ListingForm";

export default function EditListingPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const router = useRouter();
  const { data: listing, error } = useApiQuery<ListingDetail>(`/api/listings/${listingId}`);

  if (error) return <p className="text-danger">{error}</p>;
  if (!listing) return <p className="text-foreground/50">Loading...</p>;
  if (!listing.is_mine) return <p className="text-danger">You can only edit your own listings.</p>;

  return (
    <>
      <Link href={`/listings/${listingId}`} className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to listing
      </Link>
      <PageHeader
        title="Edit listing"
        subtitle={listing.status === "published" ? "Saving changes sends a live listing back for a quick review." : undefined}
      />
      <Card className="rounded-3xl p-6 max-w-3xl">
        <ListingForm
          initial={listing}
          submitLabel="Save changes"
          onSubmit={async (input) => {
            await updateListing(listingId, input);
            router.push(`/listings/${listingId}`);
          }}
        />
      </Card>
    </>
  );
}
