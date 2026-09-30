import Link from "next/link";

// Links open in a new tab so ticking through to read the terms doesn't wipe a half-filled form.
export function TermsCheckbox({
  checked,
  onChange,
  prefix,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  prefix: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-foreground/70">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-primary"
      />
      <span>
        {prefix}{" "}
        <Link href="/terms" target="_blank" className="text-primary font-medium">
          Terms and Conditions
        </Link>
        , and our{" "}
        <Link href="/privacy" target="_blank" className="text-primary font-medium">
          Privacy Policy
        </Link>
      </span>
    </label>
  );
}
