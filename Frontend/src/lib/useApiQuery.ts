"use client";

import { useEffect, useState } from "react";
import { apiAuthGet, errorMessage } from "./api";

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
export function useApiQuery<T>(path: string | null, refreshKey: string | number = "") {
  const key = path === null ? null : `${path}#${refreshKey}`;
  const [result, setResult] = useState<QueryResult<T> | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (path === null || key === null) return;
    let active = true;
    apiAuthGet<T>(path).then(
      (data) => active && setResult({ key, data }),
      (err) => active && setResult({ key, error: errorMessage(err, "Something went wrong") })
    );
    return () => {
      active = false;
    };
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
