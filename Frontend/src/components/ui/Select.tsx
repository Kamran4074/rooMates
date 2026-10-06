import { ChevronDown } from "lucide-react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, ...props }: SelectProps) {
  const select = (
    <div className="relative">
      <select
        className={`w-full appearance-none h-11 pl-4 pr-10 rounded-full border border-card-border bg-card text-sm outline-none focus:border-primary cursor-pointer ${className ?? ""}`}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="h-4 w-4 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-foreground/50" />
    </div>
  );

  if (!label) return select;
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {select}
    </label>
  );
}
