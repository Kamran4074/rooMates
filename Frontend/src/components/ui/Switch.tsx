// On/off toggle. A real <button role="switch"> so it's reachable by keyboard
// and announced as "on"/"off" by screen readers.
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  onText = "On",
  offText = "Off",
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "Riya's account active". */
  label: string;
  disabled?: boolean;
  onText?: string;
  offText?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-[5.25rem] shrink-0 items-center rounded-full text-xs font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-40 disabled:cursor-not-allowed ${
        checked ? "bg-success/20 text-success" : "bg-foreground/10 text-foreground/55"
      }`}
    >
      <span className={`absolute ${checked ? "left-2.5" : "right-2.5"}`}>{checked ? onText : offText}</span>
      <span
        className={`absolute h-5 w-5 rounded-full shadow transition-all ${checked ? "right-1 bg-success" : "left-1 bg-foreground/40"}`}
        aria-hidden="true"
      />
    </button>
  );
}
