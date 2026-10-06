import { tFr, type TFn } from "@/i18n/translations";

/** Type de prestation d'un « ménage » (au sens large : intervention datée). */
export type PrestationType = "menage" | "check_in" | "check_out";

/**
 * Libellé UI d'un type de prestation (Ménage / Check-in / Check-out).
 * Passer le `t` de `useI18n()` pour suivre la langue de l'app (français sinon).
 */
export function prestationTypeLabel(type: PrestationType | null | undefined, t: TFn = tFr): string {
  if (type === "check_in") return t("prestation.type.checkIn");
  if (type === "check_out") return t("prestation.type.checkOut");
  return t("prestation.type.menage");
}

/**
 * Classe de pastille (couleur) pour badge de type de prestation.
 * Sémantique : ménage = bleu (prestation principale), check-in = vert (arrivée),
 * check-out = rouge (départ).
 */
export function prestationTypePill(type: PrestationType | null | undefined): string {
  if (type === "check_in")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (type === "check_out")
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";
}

/**
 * Fenêtre du filtre « Passées » (liste des prestations) : les non clôturées des N
 * derniers jours. Au-delà, une prestation jamais validée / jamais pointée est
 * « oubliée » : elle sort de la liste de travail et vit dans l'Historique
 * (`stale_before` côté API), étiquetée « Non traitée ». Pas de clôture
 * automatique : c'est l'admin qui valide ou annule, à l'unité ou en lot.
 * Même valeur que le mobile (`src/lib/prestations.ts`).
 */
export const PAST_WINDOW_DAYS = 30;

/** Date locale au format YYYY-MM-DD (pas `toISOString`, qui bascule en UTC le soir). */
export function ymdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}
