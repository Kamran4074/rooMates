"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Flag, LayoutDashboard, Megaphone, Route, ScrollText, Settings, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NavLink } from "./NavLink";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/onboarding", label: "Onboarding", icon: Route },
  { href: "/admin/rooms", label: "Groups", icon: Building2 },
  { href: "/admin/listings", label: "Listings", icon: Megaphone },
  { href: "/admin/reports", label: "Reports", icon: Flag },
  { href: "/admin/audit", label: "Audit log", icon: ScrollText },
];

// The super admin's console. An operator account manages the platform; it
// doesn't split bills, so none of the member pages (rooms, expenses, history)
// are offered here.
export function AdminSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="h-full flex flex-col gap-6 p-4 overflow-y-auto" onClick={(e) => (e.target as HTMLElement).closest("a") && onNavigate?.()}>
      <Link href="/admin" className="flex items-center gap-2 font-bold text-lg px-2 h-10">
        <Logo size={32} /> RooMates
      </Link>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary px-3 mb-1">Admin console</span>
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <NavLink key={href} href={href} active={href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)}>
            <Icon className="h-4 w-4" /> {label}
          </NavLink>
        ))}
      </div>

      <div className="mt-auto flex flex-col gap-1">
        <NavLink href="/settings" active={pathname === "/settings"}>
          <Settings className="h-4 w-4" /> Settings
        </NavLink>
      </div>
    </nav>
  );
}
