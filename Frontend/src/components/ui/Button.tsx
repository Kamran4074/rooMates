interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "outline";
}

export function Button({ loading, variant = "primary", className, children, disabled, ...props }: ButtonProps) {
  const base = "py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-1.5";
  const styles =
    variant === "primary"
      ? "bg-primary text-white shadow-md shadow-primary/30 hover:bg-primary-dark"
      : "border border-card-border hover:bg-foreground/5";

  return (
    <button disabled={disabled || loading} className={`${base} ${styles} ${className ?? ""}`} {...props}>
      {children}
    </button>
  );
}
