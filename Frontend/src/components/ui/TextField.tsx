interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextField({ label, required, className, ...props }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-danger">*</span>}
      </label>
      <input
        required={required}
        className={`px-3 py-2.5 rounded-lg border border-card-border bg-background outline-none focus:border-primary ${className ?? ""}`}
        {...props}
      />
    </div>
  );
}
