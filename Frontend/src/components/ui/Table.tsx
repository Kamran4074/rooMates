// Thin styling wrappers so every data table in the app looks the same.

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full text-sm border-separate border-spacing-0">{children}</table>
    </div>
  );
}

export function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className={`text-xs font-semibold uppercase tracking-wider text-foreground/45 py-3 px-3 border-b border-card-border whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      }`}
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
