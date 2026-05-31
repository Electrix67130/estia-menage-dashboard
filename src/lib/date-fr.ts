/**
 * Format de date français centralisé. Utilise Intl côté navigateur,
 * équivalent à `date-fns` mais sans dépendance.
 *
 * Variants :
 * - `short`   : 15/05/2026
 * - `long`    : 15 mai 2026
 * - `weekday` : jeudi 15 mai 2026
 * - `month`   : mai 2026
 * - `datetime`: 15/05/2026 14:30
 * - `time`    : 14:30
 */
export type DateVariant = "short" | "long" | "weekday" | "month" | "datetime" | "time";

const FORMATTERS: Record<DateVariant, Intl.DateTimeFormatOptions> = {
  short: { day: "2-digit", month: "2-digit", year: "numeric" },
  long: { day: "numeric", month: "long", year: "numeric" },
  weekday: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  month: { month: "long", year: "numeric" },
  datetime: {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
  time: { hour: "2-digit", minute: "2-digit" },
};

export function formatDateFr(
  value: string | Date | null | undefined,
  variant: DateVariant = "short",
): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("fr-FR", FORMATTERS[variant]).format(d);
}

export function formatCurrencyFr(
  amount: number | string | null | undefined,
  currency = "EUR",
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}
