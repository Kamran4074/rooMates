"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { EmptyState } from "@/components/ui/EmptyState";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/rooms", label: "Rooms" },
  { href: "/admin/audit", label: "Audit log" },
];

// Hiding admin screens from other users is only for a tidy UI - every
// /api/admin call is rejected server-side unless the database says the
// caller is a super admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const role = useAuthStore((s) => s.user?.role);

  if (role !== "super_admin") {
    return (
      <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="Admins only">
        {role === undefined ? "If you were just made an admin, sign out and back in." : "You don't have access to this area."}
      </EmptyState>
    );
  }

  return (
    <>
      <nav className="flex gap-1 overflow-x-auto mb-6 -mx-1 px-1">
        {TABS.map((t) => {
          const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap inline-flex items-center ${
                active ? "bg-foreground text-background" : "text-foreground/65 hover:bg-foreground/5"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </>
  );
}
