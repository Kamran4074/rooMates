const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 });

// Amounts are stored as integer paise; this is the only place they become rupees.
export const rupees = (paise: number) => inr.format(Math.abs(paise) / 100);

export function formatDate(iso: string, style: "long" | "short" = "long") {
  return new Date(iso).toLocaleDateString("en-IN", style === "long" ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" });
}

export const firstName = (name?: string | null) => (name ?? "").trim().split(/\s+/)[0] || "there";
