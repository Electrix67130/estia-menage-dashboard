/**
 * Format de date centralisé. Utilise Intl côté navigateur, équivalent à
 * `date-fns` mais sans dépendance.
 *
 * Historiquement « fr » (d'où les noms), les formateurs suivent désormais la
 * langue de l'app : `I18nProvider` appelle `setDateLocale()` à chaque
 * changement de langue. Sans provider (tests, fonctions pures), c'est le
 * français. Un `locale` explicite reste possible en dernier argument.
 *
 * Variants :
 * - `short`   : 15/05/2026
 * - `long`    : 15 mai 2026
 * - `weekday` : jeudi 15 mai 2026
 * - `month`   : mai 2026
 * - `datetime`: 15/05/2026 14:30
 * - `time`    : 14:30
 */
import { INTL_LOCALE, translate, type Locale } from "@/i18n/translations";

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

let currentLocale: Locale = "fr";

/** Langue courante des formateurs (posée par `I18nProvider`). */
export function setDateLocale(locale: Locale): void {
  currentLocale = locale;
}

export function getDateLocale(): Locale {
  return currentLocale;
}

/** Balise Intl de la langue courante (ou de celle passée). */
export function intlLocale(locale: Locale = currentLocale): string {
  return INTL_LOCALE[locale] ?? INTL_LOCALE.fr;
}

export function formatDateFr(
  value: string | Date | null | undefined,
  variant: DateVariant = "short",
  locale: Locale = currentLocale,
): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), FORMATTERS[variant]).format(d);
}

export function formatCurrencyFr(
  amount: number | string | null | undefined,
  currency = "EUR",
  locale: Locale = currentLocale,
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Date relative courte : « à l'instant », « il y a 5 min », « il y a 2 h »,
 * « il y a 3 j » ; au-delà de 7 jours, la date courte. Libellés traduits
 * (clés `time.*`).
 */
export function formatRelativeFr(
  value: string | Date | null | undefined,
  now: Date = new Date(),
  locale: Locale = currentLocale,
): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const diffSec = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (diffSec < 60) return translate(locale, "time.justNow");
  const min = Math.floor(diffSec / 60);
  if (min < 60) return translate(locale, "time.minutesAgo", { n: min });
  const h = Math.floor(min / 60);
  if (h < 24) return translate(locale, "time.hoursAgo", { n: h });
  const days = Math.floor(h / 24);
  if (days <= 7) return translate(locale, "time.daysAgo", { n: days });
  return translate(locale, "time.onDate", { date: formatDateFr(d, "short", locale) });
}
