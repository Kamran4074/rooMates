import { useAuthStore } from "@/store/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.message ?? `Request failed (${res.status})`, res.status);
  }
  return data as T;
}

function authHeaders(): Record<string, string> {
  const token = useAuthStore.getState().accessToken;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

// Access tokens are short-lived (15 min) on purpose. Rather than make every
// page worry about expiry, a 401 on any authenticated call triggers exactly
// one refresh attempt here, using the long-lived refresh token, before the
// call is retried. Concurrent 401s share a single in-flight refresh instead
// of each firing their own.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  const { refreshToken, setAuth, logout } = useAuthStore.getState();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        if (!res.ok) {
          // Only a definite "this token is no good" ends the session. A 5xx or
          // rate-limit (429) is temporary - logging out for that would kick
          // people out whenever the server hiccups.
          if (res.status === 400 || res.status === 401) logout();
          return false;
        }
        const data = await res.json();
        setAuth(data.accessToken, data.refreshToken, data.user);
        return true;
      } catch {
        // Network error (server down, offline): keep the session and just let
        // this request fail; the next one will try refreshing again.
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

async function authFetch(path: string, init: RequestInit): Promise<Response> {
  let res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...init.headers, ...authHeaders() } });
  if (res.status === 401) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...init.headers, ...authHeaders() } });
    }
  }
  return res;
}

export async function apiAuthGet<T>(path: string): Promise<T> {
  const res = await authFetch(path, { method: "GET" });
  return handleResponse<T>(res);
}

async function authSend<T>(method: "POST" | "PATCH", path: string, body: unknown): Promise<T> {
  const res = await authFetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}

export const apiAuthPost = <T>(path: string, body: unknown) => authSend<T>("POST", path, body);
export const apiAuthPatch = <T>(path: string, body: unknown) => authSend<T>("PATCH", path, body);
