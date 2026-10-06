"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function PasswordField({ label, required, className, id, ...props }: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        )}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={show ? "text" : "password"}
          required={required}
          className={`w-full px-3 py-2.5 rounded-lg border border-card-border bg-background outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 pr-10 ${className ?? ""}`}
          {...props}
        />
        {/* Reachable by keyboard too (no tabIndex=-1): keyboard users need it as much as anyone. */}
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-foreground/40 hover:text-foreground/70 focus-visible:outline-2 focus-visible:outline-primary"
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
