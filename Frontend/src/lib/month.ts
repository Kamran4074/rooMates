// Months are "YYYY-MM" strings everywhere (URL, API) - easy to compare and sort.

export function currentMonth(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  return currentMonth(new Date(y, m - 1 + delta, 1));
}

export function monthLabel(month: string, style: "long" | "short" = "long") {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: style, year: "numeric" });
}

export const isValidMonth = (value: string | null): value is string => !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
