"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { usePagedQuery } from "@/lib/useApiQuery";
import type { RoomType } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { LoadingState } from "@/components/ui/Skeleton";

interface AdminRoom {
  id: string;
  name: string;
  type: RoomType;
  created_at: string;
  created_by_name: string | null;
  member_count: number;
  expense_count: number;
}

// Support view: open any expense room read-only, to see what its members see.
export default function AdminRoomsPage() {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = usePagedQuery<AdminRoom>(
    `/api/admin/rooms?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`
  );

  return (
    <>
      <PageHeader title="Rooms" subtitle="Read-only support view of every expense room." />
      <form
        className="flex items-end gap-3 mb-6 max-w-lg"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
          setPage(1);
        }}
      >
        <div className="flex-1">
          <TextField label="Room name" value={draft} onChange={(e) => setDraft(e.target.value)} />
        </div>
        <Button type="submit" size="sm">
          Search
        </Button>
      </form>

      {error ? (
        <p className="text-danger">{error}</p>
      ) : !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState icon={<Building2 className="h-6 w-6" />} title="No rooms found" />
      ) : (
        <Card className="rounded-3xl px-4 sm:px-6 py-2">
          <ul className="divide-y divide-card-border">
            {data.items.map((r) => (
              <li key={r.id}>
                <Link href={`/admin/rooms/${r.id}`} className="py-3 flex items-center gap-3 hover:opacity-80">
                  <RoomIcon type={r.type} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-xs text-foreground/50">
                      {r.member_count} members · {r.expense_count} expenses · by {r.created_by_name ?? "unknown"} · {formatDate(r.created_at, "short")}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination pagination={data.pagination} onPage={setPage} />
        </Card>
      )}
    </>
  );
}
