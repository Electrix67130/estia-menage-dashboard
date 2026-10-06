/**
 * Hub i18n du dashboard.
 * Chaque langue vit dans `locales/<code>.ts`. Ce fichier agrège + expose `translate()`.
 */

import type { Dict, Locale } from "./types";
import fr from "./locales/fr";
import en from "./locales/en";
import de from "./locales/de";
import es from "./locales/es";
import it from "./locales/it";
import pt from "./locales/pt";
import tr from "./locales/tr";
import pl from "./locales/pl";

export { LOCALES } from "./types";
export type { Locale };

export const TRANSLATIONS: Record<Locale, Dict> = { fr, en, de, es, it, pt, tr, pl };

/** Balise BCP 47 à passer à `Intl` pour chaque langue de l'app. */
export const INTL_LOCALE: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-GB",
  de: "de-DE",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  tr: "tr-TR",
  pl: "pl-PL",
};

/** Signature de `t()` : une clé + des variables `{var}`. */
export type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Translate a key, with optional placeholders `{var}` replaced. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const dict = TRANSLATIONS[locale] ?? TRANSLATIONS.fr;
  let value = dict[key] ?? TRANSLATIONS.fr[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}

/** `t()` figé en français : repli des fonctions pures appelées hors contexte React. */
export const tFr: TFn = (key, vars) => translate("fr", key, vars);

/**
 * Convention du repo pour les pluriels : deux clés, `xxx` (singulier) et
 * `xxxPlural`. Le français met 0 et 1 au singulier ; les autres langues
 * n'y mettent que 1.
 */
export function pluralKey(key: string, count: number, locale: Locale = "fr"): string {
  const n = Math.abs(count);
  const plural = locale === "fr" ? n > 1 : n !== 1;
  return plural ? `${key}Plural` : key;
}

/** Traduit `key` ou `keyPlural` selon `count`, en injectant `{count}`. */
export function translatePlural(
  locale: Locale,
  key: string,
  count: number,
  vars?: Record<string, string | number>,
): string {
  return translate(locale, pluralKey(key, count, locale), { count, ...vars });
}
