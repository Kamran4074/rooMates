"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useRequireAuth } from "@/lib/auth";
import { useLiveConnection } from "@/lib/live";
import { useRoomsStore } from "@/store/roomsStore";
import { useApprovalsStore } from "@/store/approvalsStore";
import { useNotificationsStore } from "@/store/notificationsStore";
import { useRoomModal } from "@/store/roomModalStore";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AdminSidebar } from "@/components/app/AdminSidebar";
import { useAuthStore } from "@/store/authStore";
import { AppTopbar } from "@/components/app/AppTopbar";
import { Modal } from "@/components/ui/Modal";
import { CreateRoomForm } from "@/components/rooms/CreateRoomForm";
import { JoinRoomForm } from "@/components/rooms/JoinRoomForm";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready } = useRequireAuth();
  const isAdmin = useAuthStore((s) => s.user?.role === "super_admin");
  // The super admin's account is an operator account: it gets the admin
  // console, not the member pages (rooms, expenses, history, listings).
  const adminElsewhere = isAdmin && !pathname.startsWith("/admin") && pathname !== "/settings";
  const loadRooms = useRoomsStore((s) => s.load);
  const loadApprovals = useApprovalsStore((s) => s.load);
  const loadNotifications = useNotificationsStore((s) => s.load);
  const modal = useRoomModal((s) => s.open);
  const closeModal = useRoomModal((s) => s.close);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (ready && !isAdmin) loadRooms();
  }, [ready, isAdmin, loadRooms]);

  // Payments waiting for my approval: re-checked on every page change, so a
  // new one shows up (sidebar badge + card) without a full reload.
  useEffect(() => {
    if (ready && !isAdmin) {
      loadApprovals();
      loadNotifications();
    }
  }, [ready, isAdmin, pathname, loadApprovals, loadNotifications]);

  // Live updates for members (the admin console doesn't need them).
  useLiveConnection(ready && !isAdmin);

  useEffect(() => {
    if (ready && adminElsewhere) router.replace("/admin");
  }, [ready, adminElsewhere, router]);

  async function openRoom(roomId: string) {
    closeModal();
    await loadRooms();
    router.push(`/rooms/${roomId}`);
  }

  if (!ready || adminElsewhere) return null;

  const Sidebar = isAdmin ? AdminSidebar : AppSidebar;

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-card-border bg-primary/5 h-screen sticky top-0">
        <Sidebar />
      </aside>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-card shadow-2xl">
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <AppTopbar onMenu={() => setDrawerOpen(true)} />
        <main className="flex-1 px-4 sm:px-8 py-8 max-w-6xl w-full mx-auto">{children}</main>
      </div>

      <Modal open={modal === "create"} onClose={closeModal} title="Create a room or group">
        <CreateRoomForm onCreated={(room) => openRoom(room.id)} />
      </Modal>
      <Modal open={modal === "join"} onClose={closeModal} title="Join a room">
        <JoinRoomForm onJoined={(room) => openRoom(room.id)} />
      </Modal>
    </div>
  );
}
