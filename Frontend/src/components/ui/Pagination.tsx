import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Pagination as PaginationInfo } from "@/lib/api";

// Prev / "Page x of y" / Next under any paginated list. Renders nothing when
// everything fits on one page.
export function Pagination({ pagination, onPage }: { pagination: PaginationInfo; onPage: (page: number) => void }) {
  const { page, totalPages } = pagination;
  if (totalPages <= 1) return null;

  const button = "p-2 rounded-full border border-card-border hover:bg-foreground/5 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button className={button} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="text-sm text-foreground/60">
        Page {page} of {totalPages}
      </span>
      <button className={button} onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
