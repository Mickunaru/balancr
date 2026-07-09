// Month helpers. Months are "YYYY-MM" strings (Budget.month key).

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isValidMonth(value: string): boolean {
  return MONTH_RE.test(value);
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** UTC [start, end) range covering the month, for @db.Date comparisons. */
export function monthRange(month: string): { start: Date; end: Date } {
  return {
    start: new Date(`${month}-01T00:00:00.000Z`),
    end: new Date(`${addMonths(month, 1)}-01T00:00:00.000Z`),
  };
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
