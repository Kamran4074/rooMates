export function ProgressBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const full = value >= max;
  return (
    <div className="h-2 rounded-full bg-foreground/10 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemax={max}>
      <div className={`h-full rounded-full ${full ? "bg-accent" : "bg-primary"}`} style={{ width: `${percent}%` }} />
    </div>
  );
}
