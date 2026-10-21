"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, AuthUser } from "@/store/authStore";
import { authApiPost } from "@/lib/api";
import { useHydrated } from "@/lib/useHydrated";

// The refresh token isn't in the body - the API sets it as an httpOnly cookie.
export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}

// Super admins land in the admin console; everyone else on their dashboard
// (or onboarding first).
const postAuthPath = (user: AuthUser | null) =>
  user?.role === "super_admin" ? "/admin" : user?.onboardingCompleted ? "/dashboard" : "/onboarding";

// Every flow that ends with "you're signed in" (password login, Google,
// email verification, password reset) finishes through this.
export function useCompleteAuth() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  return (data: AuthResponse) => {
    setAuth(data.accessToken, data.user);
    router.push(postAuthPath(data.user));
  };
}

// For pages that require a signed-in user. `requireOnboarding: false` is for
// the onboarding page itself, which must stay reachable before onboarding.
// `ready` stays false until after hydration so the first client render
// matches the server's (see useHydrated).
export function useRequireAuth({ requireOnboarding = true } = {}) {
  const router = useRouter();
  const hydrated = useHydrated();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  // The super admin runs the platform; onboarding (phone, first room) is for members.
  const needsOnboarding = requireOnboarding && !!user && !user.onboardingCompleted && user.role !== "super_admin";

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) router.replace("/signin");
    else if (needsOnboarding) router.replace("/onboarding");
  }, [hydrated, accessToken, needsOnboarding, router]);

  return { user, ready: hydrated && !!accessToken && !needsOnboarding };
}

// Revokes the session server-side and clears the refresh cookie, not just the
// local state - otherwise the cookie would stay usable for the rest of the
// session. Cached rooms are cleared by the rooms store itself when it ends.
export function useLogout() {
  const router = useRouter();
  return async () => {
    await authApiPost("/api/auth/logout").catch(() => {});
    useAuthStore.getState().logout();
    router.replace("/signin");
  };
}

// For pages that only make sense when signed OUT (sign in/up, verify, reset).
export function useRedirectIfAuthenticated() {
  const router = useRouter();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  useEffect(() => {
    if (accessToken) router.replace(postAuthPath(user));
  }, [accessToken, user, router]);
}
