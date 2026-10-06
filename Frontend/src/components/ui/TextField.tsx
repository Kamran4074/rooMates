"use client";

import { useId } from "react";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

// The label is tied to the input with htmlFor/id, so screen readers announce
// it and clicking the label focuses the field.
export function TextField({ label, required, className, id, ...props }: TextFieldProps) {
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
      <input
        id={inputId}
        required={required}
        className={`px-3 py-2.5 rounded-lg border border-card-border bg-background outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}
