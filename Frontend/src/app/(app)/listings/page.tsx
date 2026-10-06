"use client";

import { useState } from "react";
import Link from "next/link";
import { LocateFixed, Plus, SearchX, X } from "lucide-react";
import { usePagedQuery } from "@/lib/useApiQuery";
import { getCurrentPosition } from "@/lib/geolocation";
import { FURNISHING_LABELS, ROOM_TYPE_LABELS } from "@/lib/listings";
import type { ListingCard as Listing } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { FormMessage } from "@/components/ui/FormMessage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { ListingCard } from "@/components/listings/ListingCard";
import { LoadingState } from "@/components/ui/Skeleton";

interface Filters {
  city: string;
  minRent: string;
  maxRent: string;
  roomType: string;
  furnishing: string;
}

const EMPTY: Filters = { city: "", minRent: "", maxRent: "", roomType: "", furnishing: "" };

// Turns the filter form into the API's query string, skipping empty fields.
function toQuery(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  return q.toString();
}

export default function FindRoomPage() {
  const [draft, setDraft] = useState<Filters>(EMPTY); // what's typed
  const [filters, setFilters] = useState<Filters>(EMPTY); // what's searched
  const [near, setNear] = useState<{ lat: number; lng: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState("10");
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Near me ignores city (the location says where); the other filters still apply.
  const common = { minRent: filters.minRent, maxRent: filters.maxRent, roomType: filters.roomType, furnishing: filters.furnishing, page, limit: 12 };
  const path = near
    ? `/api/listings/nearby?${toQuery({ ...common, lat: near.lat, lng: near.lng, radiusKm })}`
    : `/api/listings?${toQuery({ ...common, city: filters.city })}`;
  const { data, error, loading } = usePagedQuery<Listing>(path);

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    setFilters(draft);
    setPage(1);
  }

  async function useMyLocation() {
    setLocating(true);
    setLocationError(null);
    try {
      setNear(await getCurrentPosition());
      setPage(1);
    } catch (err) {
      setLocationError((err as Error).message);
    } finally {
      setLocating(false);
    }
  }

  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft((d) => ({ ...d, [key]: e.target.value }));

  return (
    <>
      <PageHeader
        title="Find a room"
        subtitle="Rooms and flatmate spots posted by people on RooMates."
        actions={
          <Link href="/listings/new">
            <Button variant="dark" size="sm">
              <Plus className="h-4 w-4" /> List your room
            </Button>
          </Link>
        }
      />

      <Card className="rounded-3xl p-5 mb-6">
        <form onSubmit={applyFilters} className="grid grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div className="col-span-2">
            <TextField label="City" value={draft.city} onChange={set("city")} placeholder="e.g. Delhi" disabled={!!near} />
          </div>
          <TextField label="Min rent (₹)" type="number" min="0" value={draft.minRent} onChange={set("minRent")} />
          <TextField label="Max rent (₹)" type="number" min="0" value={draft.maxRent} onChange={set("maxRent")} />
          <Select label="Room type" value={draft.roomType} onChange={set("roomType")}>
            <option value="">Any</option>
            {Object.entries(ROOM_TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select label="Furnishing" value={draft.furnishing} onChange={set("furnishing")}>
            <option value="">Any</option>
            {Object.entries(FURNISHING_LABELS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <div className="col-span-2 lg:col-span-6 flex flex-wrap items-center gap-3">
            <Button type="submit" size="sm">
              Search
            </Button>
            {near ? (
              <>
                <span className="text-sm text-foreground/60">Near you, within</span>
                <div className="w-28">
                  <Select aria-label="Distance" value={radiusKm} onChange={(e) => { setRadiusKm(e.target.value); setPage(1); }}>
                    {["2", "5", "10", "25", "50"].map((km) => (
                      <option key={km} value={km}>
                        {km} km
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => setNear(null)}>
                  <X className="h-4 w-4" /> Clear location
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={useMyLocation} loading={locating}>
                <LocateFixed className="h-4 w-4" /> {locating ? "Locating..." : "Near me"}
              </Button>
            )}
          </div>
        </form>
        <div className="mt-3">
          <FormMessage error={locationError} />
        </div>
      </Card>

      {error ? (
        <p className="text-danger">{error}</p>
      ) : loading && !data ? (
        <LoadingState variant="cards" rows={6} />
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={<SearchX className="h-6 w-6" />} title="No rooms found">
          {near ? "Nothing listed this close yet. Try a bigger distance." : "Try another city or loosen the filters."}
        </EmptyState>
      ) : (
        data && (
          <>
            <p className="text-sm text-foreground/55 mb-4">
              {data.pagination.total} {data.pagination.total === 1 ? "room" : "rooms"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {data.items.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            <Pagination pagination={data.pagination} onPage={setPage} />
          </>
        )
      )}
    </>
  );
}
