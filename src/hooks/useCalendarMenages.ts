"use client";

import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface CalendarMenage {
  id: string;
  logement_id: string;
  created_by: string | null;
  external_source?: string | null;
  prestataire_user_id: string | null;
  prestataire_first_name: string | null;
  prestataire_last_name: string | null;
  prestataire_avatar_url: string | null;
  logement_name: string | null;
  logement_address: string | null;
  logement_city: string | null;
  logement_color: string | null;
  status: "a_venir" | "en_cours" | "termine" | "valide" | "annule";
  date_prevue: string;
  /** Prochain check-in du logement (arrivée du prochain voyageur, via iCal). */
  next_checkin_at?: string | null;
  horaire_prevu: string | null;
  duree_estimee_min: number | null;
  has_pending_reschedule?: boolean;
  date_locked?: boolean;
  /** Calculé côté API : jour passé + aucun pointage + statut a_venir. */
  needs_attention?: boolean;
}

export function logementLabel(m: {
  logement_name: string | null;
  logement_address: string | null;
  logement_city: string | null;
}): string {
  return (
    m.logement_name ||
    [m.logement_address, m.logement_city].filter(Boolean).join(" ") ||
    "Logement inconnu"
  );
}

export function prestataireLabel(m: {
  prestataire_user_id: string | null;
  prestataire_first_name: string | null;
  prestataire_last_name: string | null;
}): string {
  if (!m.prestataire_user_id) return "Non assigné";
  return [m.prestataire_first_name, m.prestataire_last_name].filter(Boolean).join(" ") || "—";
}

interface ApiResponse {
  data: CalendarMenage[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Params {
  from: string;
  to: string;
  managerOnly?: boolean;
}

/**
 * Fetch des ménages dans une plage de dates pour la vue calendrier.
 * Non-admins reçoivent automatiquement uniquement leurs ménages (RLS côté API).
 */
export function useCalendarMenages({ from, to, managerOnly }: Params) {
  const qs = new URLSearchParams();
  qs.set("from", from);
  qs.set("to", to);
  qs.set("limit", "200");
  if (managerOnly) qs.set("manager", "me");
  return useQuery({
    queryKey: ["calendar-menages", from, to, managerOnly ?? false],
    queryFn: () => apiFetch<ApiResponse>(`/menages?${qs.toString()}`),
    // Garde les ménages du mois précédent affichés pendant le fetch du nouveau
    // mois → pas de flash blanc, le clic suivant/précédent paraît instantané.
    placeholderData: keepPreviousData,
    // Cache 30s : changer de mois plusieurs fois aller-retour ne re-fetch pas.
    staleTime: 30_000,
  });
}

/**
 * Réaffecte (ou désaffecte si null) le prestataire d'un ménage — utilisé par le
 * drag-and-drop du planning. Invalide le cache calendrier/ménages.
 */
export function useAssignMenagePrestataire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ menageId, prestataire_user_id }: { menageId: string; prestataire_user_id: string | null }) =>
      apiFetch(`/menages/${menageId}`, { method: "PATCH", body: { prestataire_user_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    },
  });
}
