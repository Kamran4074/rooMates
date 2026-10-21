import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  onboardingCompleted: boolean;
  /** For showing admin UI only - the server checks the role on every admin request. */
  role?: "user" | "super_admin";
}

// The refresh token isn't here: it's an httpOnly cookie the page can't read
// (see app/api/auth). Only the short-lived access token is stored.
interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setAuth: (accessToken: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: (accessToken, user) => set({ accessToken, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, user: null }),
    }),
    {
      name: "roomates-auth",
      // v0 kept the refresh token in localStorage. Wipe the saved session so
      // it's gone from the browser; those users simply sign in once more.
      version: 1,
      migrate: () => ({ accessToken: null, user: null }),
    }
  )
);
