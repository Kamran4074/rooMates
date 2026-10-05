"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Mail, Phone, X } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { REQUEST_STATUS } from "@/lib/listings";
import type { ReceivedRequest } from "@/lib/types";
import { respondToRequest } from "@/services/listingsApi";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

// One "I'm interested" request, as the listing's owner sees it.
// Contact details arrive from the API only after it's accepted.
export function ReceivedRequestItem({
  request,
  showListing = false,
  onChange,
}: {
  request: ReceivedRequest;
  showListing?: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = REQUEST_STATUS[request.status];
  const name = request.requester_name ?? "Former user";

  async function answer(action: "accept" | "reject", markRented = false) {
    if (markRented && !window.confirm("Accept and mark the room as rented? Other waiting requests will be declined.")) return;
    setBusy(true);
    setError(null);
    try {
      await respondToRequest(request.id, action, markRented);
      onChange();
    } catch (err) {
      setError(errorMessage(err, "Couldn't update the request"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="py-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <Avatar name={name} picture={request.requester_picture} size={36} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{name}</span>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="text-xs text-foreground/50">
            {formatDate(request.created_at, "short")}
            {showListing && (
              <>
                {" · "}
                <Link href={`/listings/${request.listing_id}`} className="hover:text-primary">
                  {request.listing_title}
                </Link>
              </>
            )}
          </p>
          {request.message && <p className="text-sm mt-1.5 text-foreground/75">&ldquo;{request.message}&rdquo;</p>}
          {request.status === "accepted" && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm">
              {request.requester_phone && (
                <a href={`tel:${request.requester_phone}`} className="inline-flex items-center gap-1.5 text-primary">
                  <Phone className="h-3.5 w-3.5" /> {request.requester_phone}
                </a>
              )}
              {request.requester_email && (
                <a href={`mailto:${request.requester_email}`} className="inline-flex items-center gap-1.5 text-primary break-all">
                  <Mail className="h-3.5 w-3.5" /> {request.requester_email}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      {request.status === "pending" && (
        <div className="flex flex-wrap gap-2 sm:pl-12">
          <Button size="sm" onClick={() => answer("accept")} disabled={busy}>
            <Check className="h-4 w-4" /> Accept
          </Button>
          {request.listing_status === "published" && (
            <Button size="sm" variant="outline" onClick={() => answer("accept", true)} disabled={busy}>
              Accept & mark rented
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => answer("reject")} disabled={busy}>
            <X className="h-4 w-4" /> Decline
          </Button>
        </div>
      )}
      <FormMessage error={error} />
    </li>
  );
}
