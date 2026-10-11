"use client";

import { useEffect, useRef, useState } from "react";

// Search-as-you-type without a request per keystroke: `apply` runs once
// typing pauses for `delayMs` (debounced), or straight away on Enter.
export function useDebouncedSearch(apply: (term: string) => void, delayMs = 400) {
  const [draft, setDraft] = useState("");
  const applyRef = useRef(apply);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    applyRef.current = apply;
  });
  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    draft,
    onChange(value: string) {
      setDraft(value);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => applyRef.current(value.trim()), delayMs);
    },
    submit(e?: React.FormEvent) {
      e?.preventDefault();
      clearTimeout(timer.current);
      applyRef.current(draft.trim());
    },
  };
}
