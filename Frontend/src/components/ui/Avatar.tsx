// Google profile photo when available, otherwise the first initial.
export function Avatar({ name, picture, size = 32 }: { name: string; picture?: string | null; size?: number }) {
  if (picture) {
    // eslint-disable-next-line @next/next/no-img-element -- remote Google avatar; next/image would need domain config for a tiny icon
    return <img src={picture} alt={name} width={size} height={size} className="rounded-full object-cover" referrerPolicy="no-referrer" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="rounded-full bg-primary/15 text-primary flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim()[0]?.toUpperCase() ?? "?"}
    </span>
  );
}
