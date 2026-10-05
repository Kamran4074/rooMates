"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Settings, Plus, LogIn, Receipt, History, Search, Megaphone, Inbox, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { RoomIcon } from "@/components/rooms/RoomIcon";
import { useRoomsStore } from "@/store/roomsStore";
import { useRoomModal } from "@/store/roomModalStore";
import { useAuthStore } from "@/store/authStore";

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 h-10 px-3 rounded-xl text-sm transition-colors ${
        active ? "bg-primary/15 text-primary font-semibold" : "text-foreground/75 hover:bg-foreground/5"
      }`}
    >
      {children}
    </Link>
  );
}

export function AppSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const rooms = useRoomsStore((s) => s.rooms);
  const showModal = useRoomModal((s) => s.show);
  const isAdmin = useAuthStore((s) => s.user?.role === "super_admin");

  return (
    <nav className="h-full flex flex-col gap-6 p-4 overflow-y-auto" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg px-2 h-10">
        <Logo size={32} /> RooMates
      </Link>

      <div className="flex flex-col gap-1">
        <NavLink href="/dashboard" active={pathname === "/dashboard"}>
          <LayoutDashboard className="h-4 w-4" /> Home
        </NavLink>
        <NavLink href="/expenses" active={pathname === "/expenses"}>
          <Receipt className="h-4 w-4" /> Expenses
        </NavLink>
        <NavLink href="/history" active={pathname === "/history"}>
          <History className="h-4 w-4" /> History
        </NavLink>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/45 px-3 mb-1">Find roommates</span>
        <NavLink href="/listings" active={pathname === "/listings" || (pathname.startsWith("/listings/") && !pathname.endsWith("/edit"))}>
          <Search className="h-4 w-4" /> Find a room
        </NavLink>
        <NavLink href="/my-listings" active={pathname === "/my-listings" || pathname.endsWith("/edit") || pathname === "/listings/new"}>
          <Megaphone className="h-4 w-4" /> My listings
        </NavLink>
        <NavLink href="/requests" active={pathname === "/requests"}>
          <Inbox className="h-4 w-4" /> Requests
        </NavLink>
        {isAdmin && (
          <NavLink href="/admin" active={pathname.startsWith("/admin")}>
            <ShieldCheck className="h-4 w-4" /> Admin
          </NavLink>
        )}
      </div>

      <div className="flex flex-col gap-1 min-h-0">
        <div className="flex items-center justify-between px-3 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/45">Rooms</span>
          <div className="flex gap-1">
            <button onClick={() => showModal("join")} className="p-1 rounded-md hover:bg-foreground/5 text-foreground/55" title="Join a room" aria-label="Join a room">
              <LogIn className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => showModal("create")} className="p-1 rounded-md hover:bg-foreground/5 text-foreground/55" title="New room" aria-label="New room">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-1 overflow-y-auto">
          {rooms.length === 0 ? (
            <p className="px-3 text-xs text-foreground/45">No rooms yet</p>
          ) : (
            rooms.map((room) => (
              <NavLink key={room.id} href={`/rooms/${room.id}`} active={pathname === `/rooms/${room.id}`}>
                <RoomIcon type={room.type} size="sm" />
                <span className="truncate">{room.name}</span>
              </NavLink>
            ))
          )}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <NavLink href="/settings" active={pathname === "/settings"}>
          <Settings className="h-4 w-4" /> Settings
        </NavLink>
      </div>
    </nav>
  );
}
