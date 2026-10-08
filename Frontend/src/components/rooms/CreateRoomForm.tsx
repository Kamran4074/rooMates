"use client";

import { useState } from "react";
import { Home as HomeIcon, Plane } from "lucide-react";
import { apiAuthPost, errorMessage } from "@/lib/api";
import type { RoomType } from "@/lib/types";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";

export interface CreatedRoom {
  id: string;
  name: string;
  type: RoomType;
  inviteCode: string;
}

const types: { value: RoomType; label: string; hint: string; icon: typeof HomeIcon }[] = [
  { value: "roommates", label: "Flat / roommates", hint: "Recurring monthly costs", icon: HomeIcon },
  { value: "trip", label: "Trip / event", hint: "One-off, settle at the end", icon: Plane },
];

export function CreateRoomForm({ onCreated, submitLabel }: { onCreated: (room: CreatedRoom) => void; submitLabel?: string }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<RoomType>("roommates");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A flat is a "room"; a trip is a "group" - same thing underneath.
  const noun = type === "trip" ? "group" : "room";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      onCreated(await apiAuthPost<CreatedRoom>("/api/rooms", { name, type }));
    } catch (err) {
      setError(errorMessage(err, `Failed to create the ${noun}`));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {types.map(({ value, label, hint, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setType(value)}
            className={`text-left rounded-2xl border p-4 transition-colors ${
              type === value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-card-border hover:bg-foreground/5"
            }`}
          >
            <Icon className={`h-5 w-5 mb-2 ${type === value ? "text-primary" : "text-foreground/50"}`} />
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-foreground/50">{hint}</p>
          </button>
        ))}
      </div>
      <TextField
        label={type === "trip" ? "Group name" : "Room name"}
        required
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={type === "trip" ? "e.g. Goa Trip 2026" : "e.g. Flat 3B"}
      />
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={submitting}>
        {submitting ? "Creating..." : (submitLabel ?? `Create ${noun}`)}
      </Button>
    </form>
  );
}
