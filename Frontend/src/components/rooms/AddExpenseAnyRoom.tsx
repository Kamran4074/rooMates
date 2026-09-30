"use client";

import { useState } from "react";
import { useApiQuery } from "@/lib/useApiQuery";
import type { Member } from "@/lib/types";
import { useRoomsStore } from "@/store/roomsStore";
import { Select } from "@/components/ui/Select";
import { FormMessage } from "@/components/ui/FormMessage";
import { AddExpenseForm } from "./AddExpenseForm";

// For places that aren't inside a room (e.g. the Expenses page): pick the
// room first, then reuse the normal per-room expense form.
export function AddExpenseAnyRoom({ defaultRoomId, onAdded }: { defaultRoomId?: string; onAdded: () => void }) {
  const rooms = useRoomsStore((s) => s.rooms);
  const [roomId, setRoomId] = useState(defaultRoomId ?? rooms[0]?.id ?? "");
  const { data: members, error } = useApiQuery<Member[]>(roomId ? `/api/rooms/${roomId}/members` : null);

  if (rooms.length === 0) {
    return <p className="text-sm text-foreground/60">Create or join a room first — expenses always belong to a room.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Select label="Room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
        {rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <FormMessage error={error} />
      {members ? (
        <AddExpenseForm key={roomId} roomId={roomId} members={members} onAdded={onAdded} />
      ) : (
        !error && <p className="text-sm text-foreground/50">Loading members...</p>
      )}
    </div>
  );
}
