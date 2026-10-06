"use client";

import { Check, Clock, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { pluralKey, tFr, type Locale, type TFn } from "@/i18n/translations";
import { cn } from "@/lib/utils";

/** Compteurs de disponibilité portés par chaque ménage de `GET /menages`. */
export interface DispoCounts {
  present_count: number;
  absent_count: number;
  member_prestataire_count: number;
}

export type DispoState = "available" | "unavailable" | "no_response";

/**
 * État « Qui est dispo ? » d'une prestation sans prestataire :
 * - available : au moins un prestataire a voté « Présent » ;
 * - unavailable : aucun présent mais au moins un « Absent » ;
 * - no_response : personne n'a encore répondu.
 */
export function dispoState(m: DispoCounts): DispoState {
  if (m.present_count > 0) return "available";
  if (m.absent_count > 0) return "unavailable";
  return "no_response";
}

const STYLE: Record<DispoState, string> = {
  available: "bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  unavailable: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  no_response: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const ICON: Record<DispoState, typeof Check> = {
  available: Check,
  unavailable: X,
  no_response: Clock,
};

/** `t` et `locale` de `useI18n()` ; français par défaut (fonction pure, testable). */
export function dispoLabel(m: DispoCounts, t: TFn = tFr, locale: Locale = "fr"): string {
  const state = dispoState(m);
  if (state === "available")
    return t(pluralKey("dispo.available", m.present_count, locale), { count: m.present_count });
  if (state === "unavailable") return t("dispo.unavailable");
  return t("dispo.noResponse");
}

function dispoDetail(m: DispoCounts, t: TFn, locale: Locale): string | null {
  const state = dispoState(m);
  if (state === "unavailable")
    return t(pluralKey("dispo.absentCount", m.absent_count, locale), { count: m.absent_count });
  if (state === "no_response")
    return t(pluralKey("dispo.memberCount", m.member_prestataire_count, locale), {
      count: m.member_prestataire_count,
    });
  return null;
}

/**
 * Badge « Qui est dispo ? » : remplace la pastille « Non assigné » sur une
 * prestation sans prestataire. Les prénoms des présents ne sont pas dans la
 * liste : ils sont visibles dans le sélecteur d'affectation.
 * `compact` : icône + libellé seulement (chips du planning).
 */
export default function DispoBadge({
  menage,
  compact = false,
  className,
}: {
  menage: DispoCounts;
  compact?: boolean;
  className?: string;
}) {
  const { t, locale } = useI18n();
  const state = dispoState(menage);
  const Icon = ICON[state];
  const detail = dispoDetail(menage, t, locale);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider",
          compact ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]",
          STYLE[state],
        )}
      >
        <Icon size={compact ? 9 : 10} />
        {dispoLabel(menage, t, locale)}
      </span>
      {!compact && detail ? (
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{detail}</span>
      ) : null}
    </span>
  );
}
