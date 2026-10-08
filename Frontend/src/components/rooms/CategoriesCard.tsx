"use client";

import { useState } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/api";
import type { Category, Member } from "@/lib/types";
import { deleteCategory } from "@/services/categoriesApi";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { FormMessage } from "@/components/ui/FormMessage";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { CategoryForm } from "./CategoryForm";

// The room's bill sections and who shares each. Everyone sees them (they
// decide how expenses are split); only the room admin can change them.
export function CategoriesCard({
  roomId,
  members,
  categories,
  isAdmin,
  onChanged,
}: {
  roomId: string;
  members: Member[];
  categories: Category[];
  isAdmin: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();
  const byId = new Map(members.map((m) => [m.user_id, m]));

  async function remove(c: Category) {
    const ok = await confirm({
      title: `Delete "${c.name}"?`,
      message: "Expenses already filed under it keep their splits; they just lose the label.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await deleteCategory(roomId, c.id);
      onChanged();
    } catch (err) {
      setError(errorMessage(err, "Couldn't delete the section"));
    }
  }

  if (!isAdmin && categories.length === 0) return null;

  return (
    <Card className="rounded-3xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-semibold flex items-center gap-2">
          <Layers className="h-4 w-4" /> Bill sections
        </h2>
        {isAdmin && (
          <button onClick={() => setEditing("new")} className="inline-flex items-center gap-1 text-sm font-medium text-primary">
            <Plus className="h-4 w-4" /> Add
          </button>
        )}
      </div>
      <p className="text-xs text-foreground/50 mb-4">Each bill is split between the people in its section.</p>

      {categories.length === 0 ? (
        <p className="text-sm text-foreground/55">
          Add sections like Rent, Groceries or WiFi and pick who pays for each - e.g. leave out whoever&apos;s away this month.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {categories.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-foreground/3 px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{c.name}</p>
                <p className="text-xs text-foreground/50">
                  {c.member_ids.length === members.length ? "Everyone" : `${c.member_ids.length} of ${members.length} people`}
                </p>
              </div>
              <div className="flex -space-x-2" aria-hidden="true">
                {c.member_ids.slice(0, 4).map((id) => {
                  const m = byId.get(id);
                  return m ? <Avatar key={id} name={m.name} picture={m.picture} size={24} /> : null;
                })}
              </div>
              {isAdmin && (
                <>
                  <button onClick={() => setEditing(c)} className="p-1.5 rounded-full text-foreground/45 hover:bg-foreground/5" aria-label={`Edit ${c.name}`}>
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => remove(c)} className="p-1.5 rounded-full text-foreground/35 hover:text-danger hover:bg-danger/10" aria-label={`Delete ${c.name}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <FormMessage error={error} />
      </div>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing && editing !== "new" ? `Edit ${editing.name}` : "Add a bill section"}>
        {editing !== null && (
          <CategoryForm
            key={editing === "new" ? "new" : editing.id}
            roomId={roomId}
            members={members}
            category={editing === "new" ? undefined : editing}
            usedNames={categories.map((c) => c.name)}
            onSaved={() => {
              setEditing(null);
              onChanged();
            }}
          />
        )}
      </Modal>
    </Card>
  );
}
