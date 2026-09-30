// Indian mobile input: fixed +91 prefix, 10 digits. The backend normalises
// and validates too - this just keeps typing tidy.
export function toLocalDigits(phone: string | null | undefined) {
  return (phone ?? "").replace(/\D/g, "").slice(-10);
}

export function PhoneField({
  label = "Mobile number",
  value,
  onChange,
  hint,
}: {
  label?: string;
  value: string;
  onChange: (digits: string) => void;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor="phone">
        {label}
        <span className="text-danger">*</span>
      </label>
      <div className="flex rounded-lg border border-card-border bg-background focus-within:border-primary overflow-hidden">
        <span className="px-3 flex items-center text-sm text-foreground/60 border-r border-card-border bg-foreground/3">+91</span>
        <input
          id="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required
          pattern="[6-9][0-9]{9}"
          title="10-digit mobile number starting with 6, 7, 8 or 9"
          maxLength={10}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="98765 43210"
          className="flex-1 px-3 py-2.5 bg-transparent outline-none tracking-wide"
        />
      </div>
      {hint && <p className="text-xs text-foreground/50">{hint}</p>}
    </div>
  );
}
