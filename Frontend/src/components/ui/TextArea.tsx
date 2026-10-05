interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
}

// Multi-line sibling of TextField, same look.
export function TextArea({ label, required, className, ...props }: TextAreaProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      <textarea
        required={required}
        rows={4}
        className={`px-3 py-2.5 rounded-lg border border-card-border bg-background outline-none focus:border-primary resize-y ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}
