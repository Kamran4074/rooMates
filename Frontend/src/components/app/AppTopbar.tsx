"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, ChevronDown, Settings, LogOut } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useLogout } from "@/lib/auth";
import { Avatar } from "@/components/ui/Avatar";

export function AppTopbar({ onMenu }: { onMenu: () => void }) {
  const user = useAuthStore((s) => s.user);
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <header className="h-16 shrink-0 flex items-center justify-between lg:justify-end px-4 sm:px-8 border-b border-card-border bg-background/80 backdrop-blur sticky top-0 z-20">
      <button onClick={onMenu} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-foreground/5" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <div ref={menuRef} className="relative">
        <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-full pl-1 pr-3 h-10 hover:bg-foreground/5">
          <Avatar name={user?.name ?? ""} picture={user?.picture} size={32} />
          <span className="text-sm font-medium hidden sm:inline">{user?.name}</span>
          <ChevronDown className="h-4 w-4 text-foreground/50" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-60 bg-card border border-card-border rounded-2xl shadow-xl p-2">
            <div className="px-3 py-2 border-b border-card-border mb-1">
              <p className="text-sm font-medium truncate">{user?.name}</p>
              <p className="text-xs text-foreground/50 truncate">{user?.email}</p>
            </div>
            <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 px-3 h-9 rounded-lg text-sm hover:bg-foreground/5">
              <Settings className="h-4 w-4" /> Settings
            </Link>
            <button onClick={logout} className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-danger hover:bg-danger/5">
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
