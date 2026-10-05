"use client";

import { useState } from "react";
import { LocateFixed, Check } from "lucide-react";
import { errorMessage } from "@/lib/api";
import { getCurrentPosition } from "@/lib/geolocation";
import { AMENITY_LABELS, FURNISHING_LABELS, ROOM_TYPE_LABELS } from "@/lib/listings";
import type { ListingDetail } from "@/lib/types";
import type { ListingInput } from "@/services/listingsApi";
import { TextField } from "@/components/ui/TextField";
import { TextArea } from "@/components/ui/TextArea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

const today = () => new Date().toISOString().slice(0, 10);

function fromListing(l?: ListingDetail) {
  return {
    title: l?.title ?? "",
    description: l?.description ?? "",
    rent: l ? String(l.rent_paise / 100) : "",
    roomType: l?.room_type ?? "private_room",
    furnishing: l?.furnishing ?? "semi_furnished",
    amenities: l?.amenities ?? [],
    locality: l?.locality ?? "",
    city: l?.city ?? "",
    state: l?.state ?? "",
    pincode: l?.pincode ?? "",
    latitude: l?.latitude ?? null,
    longitude: l?.longitude ?? null,
    availableFrom: l?.available_from ?? today(),
  };
}

// Create and edit share this form. The server validates everything again;
// the HTML attributes here just catch typos before a round trip.
export function ListingForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: ListingDetail;
  submitLabel: string;
  onSubmit: (input: ListingInput) => Promise<void>;
}) {
  const [form, setForm] = useState(() => fromListing(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function toggleAmenity(a: string) {
    setForm((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }));
  }

  async function pinLocation() {
    setLocating(true);
    setError(null);
    try {
      const { lat, lng } = await getCurrentPosition();
      setForm((f) => ({ ...f, latitude: lat, longitude: lng }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ ...form, rent: Number(form.rent) });
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the listing"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <TextField label="Title" required minLength={5} maxLength={100} value={form.title} onChange={set("title")} placeholder="e.g. Furnished room near Saket metro" />
      <TextArea
        label="Description"
        required
        minLength={20}
        maxLength={2000}
        value={form.description}
        onChange={set("description")}
        placeholder="The room, the flat, who lives there, what's included in the rent..."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <TextField label="Rent per month (₹)" required type="number" min="1" step="1" value={form.rent} onChange={set("rent")} />
        <Select label="Room type" value={form.roomType} onChange={set("roomType")}>
          {Object.entries(ROOM_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select label="Furnishing" value={form.furnishing} onChange={set("furnishing")}>
          {Object.entries(FURNISHING_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
      </div>

      <div>
        <p className="text-sm font-medium mb-2">Amenities</p>
        <div className="flex flex-wrap gap-2">
          {Object.entries(AMENITY_LABELS).map(([v, l]) => {
            const on = form.amenities.includes(v);
            return (
              <button
                key={v}
                type="button"
                onClick={() => toggleAmenity(v)}
                aria-pressed={on}
                className={`inline-flex items-center gap-1 h-8 px-3 rounded-full border text-sm ${
                  on ? "border-primary bg-primary/10 text-primary" : "border-card-border hover:bg-foreground/5"
                }`}
              >
                {on && <Check className="h-3.5 w-3.5" />} {l}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Locality / area" required value={form.locality} onChange={set("locality")} placeholder="e.g. Lajpat Nagar" />
        <TextField label="City" required value={form.city} onChange={set("city")} />
        <TextField label="State" required value={form.state} onChange={set("state")} />
        <TextField label="Pincode" required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} value={form.pincode} onChange={set("pincode")} />
      </div>

      <div className="rounded-2xl border border-card-border p-4 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-48">
          <p className="text-sm font-medium">Map location (optional)</p>
          <p className="text-xs text-foreground/55">
            {form.latitude !== null
              ? "Pinned - people nearby will find this room with \"Near me\"."
              : "Stand at the room and pin it, so it shows up in \"Near me\" searches."}
          </p>
        </div>
        {form.latitude !== null ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setForm((f) => ({ ...f, latitude: null, longitude: null }))}>
            Remove pin
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={pinLocation} loading={locating}>
            <LocateFixed className="h-4 w-4" /> Use my current location
          </Button>
        )}
      </div>

      <div className="sm:w-1/2">
        <TextField label="Available from" required type="date" value={form.availableFrom} onChange={set("availableFrom")} />
      </div>

      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={saving}>
        {saving ? "Saving..." : submitLabel}
      </Button>
    </form>
  );
}
