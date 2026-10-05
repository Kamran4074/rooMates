"use client";

import { useRef, useState } from "react";
import { ImagePlus, Star, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import type { ListingImage } from "@/lib/types";
import { deleteListingPhoto, setCoverPhoto, uploadListingPhoto } from "@/services/listingsApi";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

const MAX_PHOTOS = 6;

export function PhotoManager({ listingId, images, onChange }: { listingId: string; images: ListingImage[]; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Uploads one at a time so a failure says exactly which photo failed.
  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files).slice(0, MAX_PHOTOS - images.length)) {
        await uploadListingPhoto(listingId, file);
      }
    } catch (err) {
      setError(errorMessage(err, "A photo couldn't be uploaded"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
      onChange();
    }
  }

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      onChange();
    } catch (err) {
      setError(errorMessage(err, "Something went wrong"));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {images.map((img) => (
          <div key={img.id} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-foreground/5 group">
            {/* eslint-disable-next-line @next/next/no-img-element -- Cloudinary-hosted */}
            <img src={img.url} alt="" className="h-full w-full object-cover" />
            {img.is_primary && (
              <span className="absolute top-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-medium">Cover</span>
            )}
            <div className="absolute bottom-2 right-2 flex gap-1.5">
              {!img.is_primary && (
                <button
                  onClick={() => run(() => setCoverPhoto(listingId, img.id))}
                  className="p-1.5 rounded-full bg-card/90 hover:bg-card"
                  aria-label="Make cover photo"
                  title="Make cover photo"
                >
                  <Star className="h-4 w-4" />
                </button>
              )}
              <button
                onClick={() => window.confirm("Delete this photo?") && run(() => deleteListingPhoto(listingId, img.id))}
                className="p-1.5 rounded-full bg-card/90 hover:bg-card text-danger"
                aria-label="Delete photo"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {images.length < MAX_PHOTOS && (
        <>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => input.current?.click()} loading={busy}>
            <ImagePlus className="h-4 w-4" /> {busy ? "Uploading..." : `Add photos (${images.length}/${MAX_PHOTOS})`}
          </Button>
        </>
      )}
      <FormMessage error={error} />
    </div>
  );
}
