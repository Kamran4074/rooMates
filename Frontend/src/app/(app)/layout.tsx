"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import { useRoomsStore } from "@/store/roomsStore";
import { useRoomModal } from "@/store/roomModalStore";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppTopbar } from "@/components/app/AppTopbar";
import { Modal } from "@/components/ui/Modal";
import { CreateRoomForm } from "@/components/rooms/CreateRoomForm";
import { JoinRoomForm } from "@/components/rooms/JoinRoomForm";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const loadRooms = useRoomsStore((s) => s.load);
  const modal = useRoomModal((s) => s.open);
  const closeModal = useRoomModal((s) => s.close);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (ready) loadRooms();
  }, [ready, loadRooms]);

  async function openRoom(roomId: string) {
    closeModal();
    await loadRooms();
    router.push(`/rooms/${roomId}`);
  }

  if (!ready) return null;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-card-border bg-primary/5 h-screen sticky top-0">
        <AppSidebar />
      </aside>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card shadow-2xl">
            <AppSidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <AppTopbar onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 px-4 sm:px-8 py-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>

      <Modal open={modal === "create"} onClose={closeModal} title="Create a room">
        <CreateRoomForm onCreated={(room) => openRoom(room.id)} />
      </Modal>
      <Modal open={modal === "join"} onClose={closeModal} title="Join a room">
        <JoinRoomForm onJoined={(room) => openRoom(room.id)} />
      </Modal>
    </div>
  );
}
