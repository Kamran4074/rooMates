export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="grid p-1 rounded-full bg-foreground/5" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`h-9 rounded-full text-sm font-medium transition-colors ${value === o.value ? "bg-card shadow-sm" : "text-foreground/55"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
