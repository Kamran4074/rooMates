import { Check } from "lucide-react";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2 sm:gap-6">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-semibold border ${
                done || active ? "bg-primary border-primary text-white" : "border-foreground/25 text-foreground/50"
              }`}
            >
              {done ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`hidden sm:inline text-sm ${active ? "font-semibold" : "text-foreground/55"}`}>{label}</span>
            {i < steps.length - 1 && <span className="hidden sm:block w-10 h-px bg-foreground/15 ml-2" />}
          </li>
        );
      })}
    </ol>
  );
}
