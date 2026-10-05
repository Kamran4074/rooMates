"use client";

import { useEffect, useState } from "react";
import { apiAuthGet, apiAuthGetPage, errorMessage, Page } from "./api";

interface QueryResult<T> {
  key: string;
  data?: T;
  error?: string;
}

// Authenticated GET with loading/error state. Two guarantees the old ad-hoc
// useEffect fetches didn't have:
//  - a response for an outdated request can't overwrite a newer one (e.g.
//    flicking quickly between months) - stale responses are ignored;
//  - no setState runs synchronously inside the effect; "loading" is derived
//    from whether the stored result matches the current request.
// `refreshKey` refetches the same path when something it depends on changes.
export function useApiQuery<T>(
  path: string | null,
  refreshKey: string | number = "",
  fetcher: (path: string) => Promise<T> = apiAuthGet
) {
  const key = path === null ? null : `${path}#${refreshKey}`;
  const [result, setResult] = useState<QueryResult<T> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null || key === null) return;
    let active = true;
    fetcher(path).then(
      (data) => active && setResult({ key, data }),
      (err) => active && setResult({ key, error: errorMessage(err, "Something went wrong") })
    );
    return () => {
      active = false;
    };
    // `fetcher` is a module-level function, never a new one per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, version]);

  // After reload() the previous data stays visible until fresh data arrives.
  const current = result?.key === key ? result : null;
  return {
    data: current?.data,
    error: current?.error ?? null,
    loading: key !== null && current === null,
    reload: () => setVersion((v) => v + 1),
  };
}

// Same, for paginated endpoints: data is { items, pagination }.
export function usePagedQuery<T>(path: string | null, refreshKey: string | number = "") {
  return useApiQuery<Page<T>>(path, refreshKey, apiAuthGetPage<T>);
}
