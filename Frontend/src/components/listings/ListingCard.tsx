import Link from "next/link";
import { BedDouble, MapPin, CalendarDays, ImageOff } from "lucide-react";
import { rupees, formatDate } from "@/lib/format";
import { FURNISHING_LABELS, LISTING_STATUS, ROOM_TYPE_LABELS } from "@/lib/listings";
import type { ListingCard as Listing } from "@/lib/types";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

// One listing in a grid. `showStatus` is for the owner's own list, where
// "Draft"/"In review" matters; in search everything shown is live anyway.
export function ListingCard({ listing, showStatus = false, footer }: { listing: Listing; showStatus?: boolean; footer?: React.ReactNode }) {
  const status = LISTING_STATUS[listing.status];
  return (
    <Card className="rounded-3xl overflow-hidden flex flex-col hover:shadow-lg hover:shadow-foreground/5 transition-shadow">
      <Link href={`/listings/${listing.id}`} className="flex flex-col flex-1">
        <div className="relative aspect-[4/3] bg-foreground/5">
          {listing.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- Cloudinary already serves resized images
            <img src={listing.cover_url} alt={listing.title} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-foreground/30">
              <ImageOff className="h-8 w-8" />
            </div>
          )}
          <div className="absolute top-3 left-3 flex gap-2">
            {showStatus && <Badge tone={status.tone}>{status.label}</Badge>}
            {listing.distance_km !== undefined && <Badge tone="primary">{listing.distance_km} km away</Badge>}
          </div>
        </div>
        <div className="p-4 flex flex-col gap-1.5 flex-1">
          <p className="text-lg font-semibold">
            {rupees(listing.rent_paise)}
            <span className="text-sm font-normal text-foreground/50"> / month</span>
          </p>
          <h3 className="font-medium line-clamp-1">{listing.title}</h3>
          <p className="text-sm text-foreground/55 flex items-center gap-1.5 truncate">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {listing.locality}, {listing.city}
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/55 mt-1">
            <span className="flex items-center gap-1">
              <BedDouble className="h-3.5 w-3.5" /> {ROOM_TYPE_LABELS[listing.room_type]} · {FURNISHING_LABELS[listing.furnishing]}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" /> From {formatDate(listing.available_from, "short")}
            </span>
          </div>
        </div>
      </Link>
      {footer && <div className="px-4 pb-4">{footer}</div>}
    </Card>
  );
}
