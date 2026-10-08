"use client";

import { ShieldAlert } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { EmptyState } from "@/components/ui/EmptyState";

// Navigation lives in the admin console sidebar (components/app/AdminSidebar).
// Hiding admin screens from other users is only for a tidy UI - every
// /api/admin call is rejected server-side unless the database says the
// caller is a super admin.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const role = useAuthStore((s) => s.user?.role);

  if (role !== "super_admin") {
    return (
      <EmptyState icon={<ShieldAlert className="h-6 w-6" />} title="Admins only">
        {role === undefined ? "If you were just made an admin, sign out and back in." : "You don't have access to this area."}
      </EmptyState>
    );
  }

  return <>{children}</>;
}
