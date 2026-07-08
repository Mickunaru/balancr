/** Format integer cents as a currency string. */
export function formatCents(
  cents: number,
  currency = "CAD",
  locale = "en-CA"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(cents / 100);
}
