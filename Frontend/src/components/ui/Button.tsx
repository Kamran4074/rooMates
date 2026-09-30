interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "dark" | "outline" | "ghost";
  size?: "sm" | "md";
}

const variants = {
  primary: "bg-primary text-white shadow-sm shadow-primary/30 hover:bg-primary-dark",
  dark: "bg-foreground text-background hover:bg-foreground/85",
  outline: "border border-card-border bg-card hover:bg-foreground/5",
  ghost: "hover:bg-foreground/5",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5",
};

// Pill-shaped by default - part of the app's premium, Brevo-style look.
export function Button({
  loading,
  variant = "primary",
  size = "md",
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-1.5 ${variants[variant]} ${sizes[size]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
