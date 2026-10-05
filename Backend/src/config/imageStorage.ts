import crypto from "crypto";
import { env } from "./env";
import { logger } from "./logger";
import { AppError } from "../middlewares/errorHandler";

// Listing photos live on Cloudinary, not on this server: Render's free disk is
// wiped on every deploy. The browser uploads straight to Cloudinary using a
// short-lived signature from us, so photo bytes never pass through the API.
//
// Why signed: the signature fixes the exact public_id (file name) and allowed
// formats. Without it, anyone could upload anything to our Cloudinary account.
// Plain HTTPS + crypto, no SDK - this is all the API we need.

const ALLOWED_FORMATS = "jpg,jpeg,png,webp";

export const isImageStorageConfigured = () =>
  Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET);

function requireConfig() {
  if (!isImageStorageConfigured()) {
    throw new AppError("Photo uploads aren't set up on this server yet", 503);
  }
  return { cloud: env.CLOUDINARY_CLOUD_NAME!, key: env.CLOUDINARY_API_KEY!, secret: env.CLOUDINARY_API_SECRET! };
}

// Cloudinary's scheme: sort the params, join as a=1&b=2, append the secret, SHA-1.
function sign(params: Record<string, string | number>, secret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createHash("sha1").update(payload + secret).digest("hex");
}

export const listingImagePrefix = (listingId: string) => `roomates/listings/${listingId}/`;

export function createUploadSignature(listingId: string) {
  const { cloud, key, secret } = requireConfig();
  const params = {
    allowed_formats: ALLOWED_FORMATS,
    public_id: `${listingImagePrefix(listingId)}${crypto.randomUUID()}`,
    timestamp: Math.floor(Date.now() / 1000),
  };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${cloud}/image/upload`,
    apiKey: key,
    ...params,
    signature: sign(params, secret),
  };
}

// After the browser uploads, it tells us the result. Only accept files that
// are in this listing's folder on OUR Cloudinary account - otherwise someone
// could attach any image URL from the internet to their listing.
export function assertOwnUpload(listingId: string, publicId: string, url: string) {
  const { cloud } = requireConfig();
  const ok =
    publicId.startsWith(listingImagePrefix(listingId)) &&
    url.startsWith(`https://res.cloudinary.com/${cloud}/image/upload/`) &&
    url.includes(`/${publicId}.`);
  if (!ok) throw new AppError("That image wasn't uploaded for this listing", 400);
}

// Best effort: a failed delete leaves an orphaned file on Cloudinary, which
// costs a little storage but must not block deleting the listing itself.
export async function deleteImage(publicId: string) {
  if (!isImageStorageConfigured()) return;
  const { cloud, key, secret } = requireConfig();
  const params = { public_id: publicId, timestamp: Math.floor(Date.now() / 1000) };
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...params, timestamp: String(params.timestamp), api_key: key, signature: sign(params, secret) }),
    });
    if (!res.ok) logger.warn("Cloudinary delete failed", { publicId, status: res.status });
  } catch (err) {
    logger.warn("Cloudinary delete failed", { publicId, error: (err as Error).message });
  }
}
