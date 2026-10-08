"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/api";
import type { Category, Member } from "@/lib/types";
import { createCategory, updateCategory } from "@/services/categoriesApi";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { MemberPicker } from "./MemberPicker";

// Common bills, one tap to fill the name.
const SUGGESTIONS = ["Rent", "Groceries", "WiFi", "Electricity", "Gas", "Water", "Maid"];

// Add or edit a bill section: its name and who shares it.
export function CategoryForm({
  roomId,
  members,
  category,
  usedNames,
  onSaved,
}: {
  roomId: string;
  members: Member[];
  /** Editing this one; omitted = adding a new section. */
  category?: Category;
  /** Names already taken in this room (suggestions skip them). */
  usedNames: string[];
  onSaved: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [memberIds, setMemberIds] = useState(category?.member_ids ?? members.map((m) => m.user_id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const taken = new Set(usedNames.map((n) => n.toLowerCase()));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const input = { name: name.trim(), memberIds };
      if (category) await updateCategory(roomId, category.id, input);
      else await createCategory(roomId, input);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the section"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField label="Section name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Groceries" />
      {!category && (
        <div className="flex flex-wrap gap-1.5 -mt-2">
          {SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase())).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setName(s)}
              className="h-7 px-3 rounded-full text-xs border border-card-border hover:bg-foreground/5"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      <MemberPicker members={members} selected={memberIds} onChange={setMemberIds} label="Who pays for it?" />
      <p className="text-xs text-foreground/55">
        Expenses in this section are split equally between these {memberIds.length} {memberIds.length === 1 ? "person" : "people"}. New
        roommates are added automatically; untick anyone who doesn&apos;t share it.
      </p>
      <FormMessage error={error} />
      <Button type="submit" variant="dark" loading={saving} disabled={memberIds.length === 0}>
        {saving ? "Saving..." : category ? "Save section" : "Add section"}
      </Button>
    </form>
  );
}
