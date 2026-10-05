"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createListing } from "@/services/listingsApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { ListingForm } from "@/components/listings/ListingForm";

export default function NewListingPage() {
  const router = useRouter();
  return (
    <>
      <Link href="/my-listings" className="inline-flex items-center gap-1.5 text-sm text-foreground/55 hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> My listings
      </Link>
      <PageHeader title="List your room" subtitle="It's saved as a draft. Next you'll add photos and send it for review." />
      <Card className="rounded-3xl p-6 max-w-3xl">
        <ListingForm
          submitLabel="Save draft & add photos"
          onSubmit={async (input) => {
            const { id } = await createListing(input);
            router.push(`/listings/${id}`);
          }}
        />
      </Card>
    </>
  );
}
