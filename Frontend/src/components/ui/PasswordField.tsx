"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function PasswordField({ label, required, className, ...props }: PasswordFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          required={required}
          className={`w-full px-3 py-2.5 rounded-lg border border-card-border bg-background outline-none focus:border-primary pr-10 ${className ?? ""}`}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40"
          tabIndex={-1}
          aria-label={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
