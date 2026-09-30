const tones = {
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  primary: "bg-primary/10 text-primary",
  accent: "bg-accent/15 text-accent",
};

export function StatCard({
  icon,
  label,
  value,
  tone,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: keyof typeof tones;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-foreground/3 p-4">
      <span className={`inline-flex h-8 w-8 rounded-full items-center justify-center mb-3 ${tones[tone]}`}>{icon}</span>
      <p className="text-xs text-foreground/55">{label}</p>
      <p className="text-xl font-semibold mt-0.5">{value}</p>
      {hint && <p className="text-xs text-foreground/45 mt-0.5">{hint}</p>}
    </div>
  );
}
