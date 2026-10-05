import type { BadgeTone } from "@/components/ui/Badge";
import type { ListingStatus, RequestStatus } from "./types";

// Display labels for the API's enum values - kept in one place so every page
// says "Semi-furnished", never "semi_furnished".

export const ROOM_TYPE_LABELS = {
  private_room: "Private room",
  shared_room: "Shared room",
  entire_flat: "Entire flat",
} as const;

export const FURNISHING_LABELS = {
  furnished: "Furnished",
  semi_furnished: "Semi-furnished",
  unfurnished: "Unfurnished",
} as const;

export const AMENITY_LABELS = {
  wifi: "Wi-Fi",
  ac: "AC",
  parking: "Parking",
  washing_machine: "Washing machine",
  kitchen: "Kitchen",
  power_backup: "Power backup",
  attached_bathroom: "Attached bathroom",
  geyser: "Geyser",
} as const;

export const REPORT_REASON_LABELS = {
  fake_listing: "Fake listing",
  wrong_information: "Wrong information",
  already_rented: "Already rented",
  spam: "Spam",
  other: "Other",
} as const;

export const LISTING_STATUS: Record<ListingStatus, { label: string; tone: BadgeTone; hint: string }> = {
  draft: { label: "Draft", tone: "neutral", hint: "Only you can see it. Add photos, then submit it for review." },
  pending: { label: "In review", tone: "accent", hint: "A moderator will check it shortly." },
  published: { label: "Live", tone: "success", hint: "Visible to everyone looking for a room." },
  rejected: { label: "Changes needed", tone: "danger", hint: "Fix what the moderator mentioned and submit again." },
  rented: { label: "Rented", tone: "primary", hint: "Hidden from search. Relist it when it's free again." },
  removed: { label: "Removed", tone: "danger", hint: "Taken down by a moderator." },
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Waiting", tone: "accent" },
  accepted: { label: "Accepted", tone: "success" },
  rejected: { label: "Declined", tone: "neutral" },
};
