const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

// Amounts are stored as integer paise; this is the only place they become rupees.
export const rupees = (paise: number) => inr.format(Math.abs(paise) / 100);

export function formatDate(iso: string, style: "long" | "short" = "long") {
  return new Date(iso).toLocaleDateString("en-IN", style === "long" ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" });
}

// Today in India, as YYYY-MM-DD (the API uses Indian calendar days for expense and payment dates).
export const todayInIndia = () => new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

// "just now", "5 min ago", "3 hours ago", "2 days ago", then a date.
export function timeAgo(iso: string | null | undefined, never = "Never") {
  if (!iso) return never;
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  return formatDate(iso, "long");
}

export const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "there";
