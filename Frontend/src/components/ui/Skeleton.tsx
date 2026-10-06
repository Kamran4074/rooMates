// Grey placeholder shapes shown while data loads, in roughly the layout that's
// coming - the page doesn't jump around when the real content arrives.

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-foreground/8 ${className}`} aria-hidden="true" />;
}

type Variant = "page" | "list" | "cards";

// role="status" + hidden text: screen readers hear "Loading" instead of nothing.
export function LoadingState({ variant = "list", rows = 4 }: { variant?: Variant; rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {variant === "page" && (
        <div className="flex flex-col gap-6">
          <Skeleton className="h-8 w-56" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-64" />
        </div>
      )}
      {variant === "list" && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}
      {variant === "cards" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: rows }, (_, i) => (
            <Skeleton key={i} className="h-64 rounded-3xl" />
          ))}
        </div>
      )}
    </div>
  );
}
