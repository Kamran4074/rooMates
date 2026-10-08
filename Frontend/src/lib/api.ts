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

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

// Every API response is { success, message?, data, pagination? } (errors:
// { success: false, message }). It's unwrapped here, once, so callers just
// get `data`. A 204 has no body, hence the catch.
async function readBody(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status);
  }
  return body;
}

async function handleResponse<T>(res: Response): Promise<T> {
  return (await readBody(res))?.data as T;
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
        const { data } = await res.json();
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

// For paginated list endpoints, which also send `pagination`.
export async function apiAuthGetPage<T>(path: string): Promise<Page<T>> {
  const body = await readBody(await authFetch(path, { method: "GET" }));
  return { items: body.data, pagination: body.pagination };
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

export async function apiAuthDelete(path: string): Promise<void> {
  await handleResponse(await authFetch(path, { method: "DELETE" }));
}

// Authenticated file download (e.g. the admin CSV export). A plain <a href>
// can't send the Authorization header, so: fetch -> blob -> temporary link.
export async function apiAuthDownload(path: string, fallbackName: string): Promise<void> {
  const res = await authFetch(path, { method: "GET" });
  if (!res.ok) await readBody(res); // throws ApiError with the server's message
  const name = res.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  const url = URL.createObjectURL(await res.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

// For endpoints whose `data` is an object (not a list) but that still send
// `pagination`, e.g. the onboarding tracker: { counts, items } + pagination.
export async function apiAuthGetPaged<T>(path: string): Promise<{ data: T; pagination: Pagination }> {
  const body = await readBody(await authFetch(path, { method: "GET" }));
  return { data: body.data, pagination: body.pagination };
}

// A long-lived authenticated GET (the live-updates event stream). Goes through
// the same refresh-and-retry as every other call when the access token expired.
export const apiAuthStream = (path: string, signal: AbortSignal) =>
  authFetch(path, { method: "GET", signal, headers: { Accept: "text/event-stream" } });
