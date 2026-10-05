import { apiAuthDelete, apiAuthPatch, apiAuthPost, ApiError } from "@/lib/api";
import type { ListingImage, ListingStatus, RequestStatus } from "@/lib/types";

// Every listings/requests call the UI makes. Components call these instead
// of building URLs and bodies themselves. (Reads go through useApiQuery /
// usePagedQuery with the paths documented in the API.)

export interface ListingInput {
  title: string;
  description: string;
  rent: number;
  roomType: string;
  furnishing: string;
  amenities: string[];
  locality: string;
  city: string;
  state: string;
  pincode: string;
  latitude: number | null;
  longitude: number | null;
  availableFrom: string;
}

export const createListing = (input: ListingInput) =>
  apiAuthPost<{ id: string; status: ListingStatus }>("/api/listings", input);

export const updateListing = (id: string, input: Partial<ListingInput>) =>
  apiAuthPatch<{ id: string; status: ListingStatus }>(`/api/listings/${id}`, input);

export const changeListingStatus = (id: string, action: "submit" | "mark_rented" | "relist") =>
  apiAuthPost<{ id: string; status: ListingStatus }>(`/api/listings/${id}/status`, { action });

export const deleteListing = (id: string) => apiAuthDelete(`/api/listings/${id}`);

export const reportListing = (id: string, reason: string, description?: string) =>
  apiAuthPost(`/api/listings/${id}/reports`, { reason, description });

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

// 1. ask our API for a signed upload, 2. send the file straight to
// Cloudinary, 3. tell our API the result. The photo never passes through our
// server, and the signature only allows this one file name in this listing's folder.
export async function uploadListingPhoto(listingId: string, file: File): Promise<ListingImage> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new ApiError("Use a JPG, PNG or WebP photo", 400);
  if (file.size > MAX_PHOTO_BYTES) throw new ApiError("Photos must be under 5 MB", 400);

  const sig = await apiAuthPost<{
    uploadUrl: string;
    apiKey: string;
    public_id: string;
    timestamp: number;
    allowed_formats: string;
    signature: string;
  }>(`/api/listings/${listingId}/images/upload-signature`, {});

  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("public_id", sig.public_id);
  form.append("allowed_formats", sig.allowed_formats);
  form.append("signature", sig.signature);
  const res = await fetch(sig.uploadUrl, { method: "POST", body: form });
  if (!res.ok) throw new ApiError("The photo couldn't be uploaded. Try another one.", res.status);
  const uploaded = (await res.json()) as { public_id: string; secure_url: string };

  return apiAuthPost<ListingImage>(`/api/listings/${listingId}/images`, {
    publicId: uploaded.public_id,
    url: uploaded.secure_url,
  });
}

export const deleteListingPhoto = (listingId: string, imageId: string) =>
  apiAuthDelete(`/api/listings/${listingId}/images/${imageId}`);

export const setCoverPhoto = (listingId: string, imageId: string) =>
  apiAuthPost(`/api/listings/${listingId}/images/${imageId}/cover`, {});

// ---------------- Interest requests ----------------

export const sendInterest = (listingId: string, message?: string) =>
  apiAuthPost<{ id: string; status: RequestStatus }>("/api/requests", { listingId, message: message || undefined });

export const respondToRequest = (requestId: string, action: "accept" | "reject", markRented = false) =>
  apiAuthPatch<{ id: string; status: RequestStatus; listingRented: boolean }>(`/api/requests/${requestId}`, {
    action,
    markRented,
  });
