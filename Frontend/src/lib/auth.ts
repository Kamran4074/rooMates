"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore, AuthUser } from "@/store/authStore";
import { apiPost } from "@/lib/api";
import { useHydrated } from "@/lib/useHydrated";

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

const postAuthPath = (user: AuthUser | null) => (user?.onboardingCompleted ? "/dashboard" : "/onboarding");

// Every flow that ends with "you're signed in" (password login, Google,
// email verification, password reset) finishes through this.
export function useCompleteAuth() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  return (data: AuthResponse) => {
    setAuth(data.accessToken, data.refreshToken, data.user);
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
  const needsOnboarding = requireOnboarding && !!user && !user.onboardingCompleted;

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) router.replace("/signin");
    else if (needsOnboarding) router.replace("/onboarding");
  }, [hydrated, accessToken, needsOnboarding, router]);

  return { user, ready: hydrated && !!accessToken && !needsOnboarding };
}

// Revokes the refresh token server-side, not just locally - otherwise a copy
// of it (e.g. from a shared computer) would stay usable for its full lifetime.
// Cached rooms are cleared by the rooms store itself when the session ends.
export function useLogout() {
  const router = useRouter();
  return async () => {
    const { refreshToken, logout } = useAuthStore.getState();
    if (refreshToken) {
      await apiPost("/api/auth/logout", { refreshToken }).catch(() => {});
    }
    logout();
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
