"use client";

import { Globe } from "lucide-react";
import { useI18n, LOCALES, Locale } from "@/contexts/I18nContext";

/**
 * Sélecteur de langue compact, pour les écrans où la barre latérale et ses
 * réglages ne sont pas disponibles — connexion, inscription, invitation.
 *
 * Sans lui, le sélecteur ne vit que dans les Réglages, donc derrière une
 * authentification que la personne n'a pas encore franchie : impossible de
 * changer de langue au moment précis où on en a besoin.
 *
 * Un `select` natif plutôt qu'un menu maison : accessible au clavier et aux
 * lecteurs d'écran sans travail supplémentaire, et sur mobile il ouvre la roue
 * système, plus confortable que huit lignes dans une carte étroite.
 */
export default function LanguageSwitch({ className = "" }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <Globe size={14} className="pointer-events-none absolute left-2 text-zinc-400" />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("settings.language")}
        className="cursor-pointer appearance-none rounded-lg border border-zinc-200 bg-white py-1.5 pl-7 pr-3 text-sm text-zinc-600 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </div>
  );
}
