"use client";

import { useId } from "react";

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

// Multi-line sibling of TextField, same look and the same label wiring.
export function TextArea({ label, required, className, id, ...props }: TextAreaProps) {
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
      <textarea
        id={inputId}
        required={required}
        rows={4}
        className={`px-3 py-2.5 rounded-lg border border-card-border bg-background outline-none focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 resize-y ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}
