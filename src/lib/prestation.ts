/** Type de prestation d'un « ménage » (au sens large : intervention datée). */
export type PrestationType = "menage" | "check_in" | "check_out";

/** Libellé UI d'un type de prestation (Ménage / Check-in / Check-out). */
export function prestationTypeLabel(type: PrestationType | null | undefined): string {
  if (type === "check_in") return "Check-in";
  if (type === "check_out") return "Check-out";
  return "Ménage";
}

/** Classe de pastille (couleur) pour badge de type de prestation. */
export function prestationTypePill(type: PrestationType | null | undefined): string {
  if (type === "check_in")
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (type === "check_out")
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300";
}
