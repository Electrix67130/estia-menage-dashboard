/** Type de prestation d'un « ménage » (au sens large : intervention datée). */
export type PrestationType = "menage" | "check_in" | "check_out";

/** Libellé UI d'un type de prestation (Ménage / Check-in / Check-out). */
export function prestationTypeLabel(type: PrestationType | null | undefined): string {
  if (type === "check_in") return "Check-in";
  if (type === "check_out") return "Check-out";
  return "Ménage";
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
