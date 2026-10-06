"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from "react";
import { translate, translatePlural, LOCALES, Locale } from "@/i18n/translations";
import { setDateLocale } from "@/lib/date-fr";

export type { Locale };
export { LOCALES };

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  /** Pluriel : `key` ou `keyPlural` selon `count` (injecté en `{count}`). */
  tp: (key: string, count: number, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "estia-menage_locale";

/**
 * Valeur de repli (français) quand un composant est rendu hors `I18nProvider`
 * — tests unitaires, composants isolés. L'app réelle est toujours sous le
 * provider (`providers.tsx`).
 */
const FALLBACK: I18nContextValue = {
  locale: "fr",
  setLocale: () => {},
  t: (key, vars) => translate("fr", key, vars),
  tp: (key, count, vars) => translatePlural("fr", key, count, vars),
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (stored && LOCALES.some((l) => l.code === stored)) setLocaleState(stored);
  }, []);

  // Les formateurs de dates (`formatDateFr`, `formatRelativeFr`) suivent la
  // langue de l'app ; retour au français quand le provider se démonte.
  useEffect(() => {
    setDateLocale(locale);
    return () => setDateLocale("fr");
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, vars) => translate(locale, key, vars),
      tp: (key, count, vars) => translatePlural(locale, key, count, vars),
    }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext) ?? FALLBACK;
}

// Compat alias.
export const useLocale = useI18n;
