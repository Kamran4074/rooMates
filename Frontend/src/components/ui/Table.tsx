import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

// Thin styling wrappers so every data table in the app looks the same.

// Pages with a MobileList pass className="hidden sm:block" so phones get the
// list instead of a table they'd have to scroll sideways.
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto -mx-6 px-6 ${className ?? ""}`}>
      <table className="w-full text-sm border-separate border-spacing-0">{children}</table>
    </div>
  );
}

// The phone-sized alternative to a Table: one stacked row per record.
export function MobileList({ children }: { children: React.ReactNode }) {
  return <ul className="sm:hidden divide-y divide-card-border -my-3">{children}</ul>;
}

// className is for responsive columns, e.g. "hidden 2xl:table-cell" on both the Th and its Tds.
export function Th({ children, align = "left", className }: { children?: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <th
      className={`text-xs font-semibold uppercase tracking-wider text-foreground/45 py-3 px-3 border-b border-card-border whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      } ${className ?? ""}`}
    >
      {children}
    </th>
  );
}

export function Td({ children, align = "left", className }: { children?: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={`py-3.5 px-3 border-b border-card-border ${align === "right" ? "text-right tabular-nums" : ""} ${className ?? ""}`}>
      {children}
    </td>
  );
}

// Clickable column header: shows which way the column is sorted (or that it can be).
export function SortButton({ label, direction, onClick }: { label: string; direction: "asc" | "desc" | null; onClick: () => void }) {
  const Icon = direction === "desc" ? ArrowDown : direction === "asc" ? ArrowUp : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${direction ? `, currently ${direction === "asc" ? "ascending" : "descending"}` : ""}`}
      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground"
    >
      {label} <Icon className={`h-3 w-3 ${direction ? "" : "opacity-40"}`} aria-hidden="true" />
    </button>
  );
}
