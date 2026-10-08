"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, PiggyBank } from "lucide-react";
import { useRoomsStore } from "@/store/roomsStore";
import { useRoomModal } from "@/store/roomModalStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { RoomIcon } from "@/components/rooms/RoomIcon";

// A way into a room's fund from outside the room (e.g. the Expenses page):
//   a room already picked (the page's room filter) or only one room -> straight there;
//   several rooms -> choose one;   no rooms -> offer to create one.
export function RoomFundButton({ roomId }: { roomId?: string }) {
  const router = useRouter();
  const rooms = useRoomsStore((s) => s.rooms);
  const showRoomModal = useRoomModal((s) => s.show);
  const [picking, setPicking] = useState(false);

  function open() {
    const target = roomId || (rooms.length === 1 ? rooms[0].id : "");
    if (target) router.push(`/rooms/${target}/fund`);
    else setPicking(true);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={open}>
        <PiggyBank className="h-4 w-4" /> Room fund
      </Button>

      <Modal open={picking} onClose={() => setPicking(false)} title="Which room's fund?">
        {rooms.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground/60">A fund belongs to a room or group. Create one first, then start its fund.</p>
            <Button
              variant="dark"
              onClick={() => {
                setPicking(false);
                showRoomModal("create");
              }}
            >
              Create a room or group
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {rooms.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/rooms/${r.id}/fund`}
                  onClick={() => setPicking(false)}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-foreground/5"
                >
                  <RoomIcon type={r.type} size="sm" />
                  <span className="flex-1 font-medium truncate">{r.name}</span>
                  <span className="text-xs text-foreground/50">{r.type === "trip" ? "Trip" : "Flat"}</span>
                  <ChevronRight className="h-4 w-4 text-foreground/35" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
