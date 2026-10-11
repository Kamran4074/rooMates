import Link from "next/link";
import { RotateCcw, SearchX, TriangleAlert } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Button } from "./Button";

// What a detail page shows when its data can't load. A 404 (wrong id in the
// URL, or a room you're not in) gets a "not found" screen with a way back,
// inside the app's layout; anything else offers a retry.
export function PageError({
  error,
  notFound,
  onRetry,
  what = "page",
  backHref = "/dashboard",
  backLabel = "Go to dashboard",
}: {
  error: string;
  notFound: boolean;
  onRetry?: () => void;
  /** "room", "listing"... used in the not-found title. */
  what?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const back = (
    <Link
      href={backHref}
      className="h-10 px-5 rounded-full bg-foreground text-background font-medium inline-flex items-center hover:bg-foreground/85"
    >
      {backLabel}
    </Link>
  );

  if (notFound) {
    return (
      <EmptyState icon={<SearchX className="h-6 w-6" />} title={`This ${what} doesn't exist`} action={back}>
        The link may be wrong, or it was deleted - or you don&apos;t have access to it.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={<TriangleAlert className="h-6 w-6" />}
      title={`Couldn't load this ${what}`}
      action={
        <div className="flex flex-wrap justify-center gap-3">
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" /> Try again
            </Button>
          )}
          {back}
        </div>
      }
    >
      {error}
    </EmptyState>
  );
}
