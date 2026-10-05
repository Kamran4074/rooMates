const tones = {
  neutral: "bg-foreground/8 text-foreground/70",
  primary: "bg-primary/12 text-primary",
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
  accent: "bg-accent/15 text-accent",
};

export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}
