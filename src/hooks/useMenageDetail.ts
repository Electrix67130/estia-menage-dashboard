"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PrestationType } from "@/lib/prestation";

/** Libellé d'origine d'un ménage (Manuel / Airbnb / Booking…) pour badge. */
export function menageSourceLabel(externalSource?: string | null): string {
  if (!externalSource) return "Manuel";
  const provider = externalSource.replace(/^cal_/, "");
  const map: Record<string, string> = {
    airbnb: "Airbnb",
    booking: "Booking",
    vrbo: "Vrbo",
    ical: "iCal",
  };
  return map[provider] ?? "Externe";
}

export interface MenageDetail {
  id: string;
  logement_id: string;
  organization_id: string;
  created_by: string;
  prestataire_user_id: string | null;
  status: "a_venir" | "en_cours" | "termine" | "valide" | "annule";
  /** Type de prestation : ménage classique, check-in (arrivée) ou check-out (départ). */
  prestation_type: PrestationType;
  date_prevue: string;
  /** Prochain check-in du logement (arrivée du prochain voyageur, via iCal). */
  next_checkin_at?: string | null;
  /** Nb de nuits du séjour nettoyé (via iCal). */
  stay_nights?: number | null;
  /** True quand la date est verrouillée (reschedule appliqué ou PATCH manuel). La sync iCal ne l'écrasera pas. */
  date_locked?: boolean;
  /** Calculé côté API : jour passé + aucun pointage + statut a_venir. */
  needs_attention?: boolean;
  horaire_prevu: string | null;
  duree_estimee_min: number | null;
  date_realisation: string | null;
  arrived_at: string | null;
  departed_at: string | null;
  arrival_photo_url: string | null;
  arrival_lat: string | number | null;
  arrival_lng: string | number | null;
  departure_photo_url: string | null;
  departure_lat: string | number | null;
  departure_lng: string | number | null;
  traveler_rating: number | null;
  has_degradation: boolean;
  degradation_note: string | null;
  prix_prevu: string | number | null;
  client_price_ht: string | number | null;
  client_vat_rate: string | number | null;
  provider_price: string | number | null;
  currency: string;
  laundry_included: boolean;
  laundry_client_price_ht: string | number | null;
  laundry_provider_price: string | number | null;
  n_lit_simple: number;
  n_lit_double: number;
  n_canape_lit: number;
  n_lit_appoint: number;
  n_travelers: number | null;
  validated_at: string | null;
  validated_by: string | null;
  validated_price: string | number | null;
  notes_intervention: string | null;
  external_source?: string | null;
  /** true = prestation auto « retirée » (sync_ignored) : peut être remise. */
  sync_ignored?: boolean;
  prestataire_first_name?: string | null;
  prestataire_last_name?: string | null;
  prestataire_avatar_url?: string | null;
  logement_name?: string | null;
  logement_address?: string | null;
  logement_city?: string | null;
  /** Code de la boîte à clés du logement (pour le presta affecté). */
  logement_key_safe_code?: string | null;
  logement_latitude?: string | number | null;
  logement_longitude?: string | number | null;
}

export interface EligiblePrestataire {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  /** true = membre prestataire du logement ; false = affectation ponctuelle possible. */
  is_member: boolean;
}

const KEY = ["menage-detail"] as const;

export function useMenageDetail(menageId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, menageId],
    queryFn: () => apiFetch<MenageDetail>(`/menages/${menageId}`),
    enabled: !!menageId,
  });
}

export function useEligiblePrestataires(menageId: string | undefined) {
  return useQuery({
    queryKey: ["menage-eligible-prestataires", menageId],
    queryFn: () =>
      apiFetch<{ data: EligiblePrestataire[] }>(
        `/menages/${menageId}/eligible-prestataires`,
      ).then((r) => r.data),
    enabled: !!menageId,
  });
}

export function useAssignPrestataire(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prestataire_user_id: string | null) =>
      apiFetch<MenageDetail>(`/menages/${menageId}`, {
        method: "PATCH",
        body: { prestataire_user_id },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, menageId] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    },
  });
}

export interface UpdateMenageInput {
  prestataire_user_id?: string | null;
  date_prevue?: string;
  horaire_prevu?: string | null;
  duree_estimee_min?: number | null;
  client_price_ht?: number | null;
  client_vat_rate?: number | null;
  provider_price?: number | null;
  currency?: string;
  laundry_included?: boolean;
  laundry_client_price_ht?: number | null;
  laundry_provider_price?: number | null;
  n_lit_simple?: number;
  n_lit_double?: number;
  n_canape_lit?: number;
  n_lit_appoint?: number;
  n_travelers?: number | null;
  notes_intervention?: string | null;
  status?: "a_venir" | "en_cours" | "termine" | "valide" | "annule";
  arrived_at?: string | null;
  departed_at?: string | null;
  /** Déverrouille la date pour ré-autoriser la sync iCal à écraser la valeur. */
  date_locked?: boolean;
}

export function useUpdateMenage(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMenageInput) =>
      apiFetch<MenageDetail>(`/menages/${menageId}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menage-detail", menageId] });
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    },
  });
}

export interface UpdateDeclarationInput {
  traveler_rating?: number;
  has_degradation?: boolean;
  degradation_note?: string;
}

/** Édite la déclaration voyageurs (note + dégradation) a posteriori (admin). */
export function useUpdateDeclaration(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateDeclarationInput) =>
      apiFetch<MenageDetail>(`/menages/${menageId}/declaration`, { method: "PUT", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menage-detail", menageId] });
      qc.invalidateQueries({ queryKey: ["menages"] });
    },
  });
}

export interface CreateMenageInput {
  logement_id: string;
  prestation_type?: PrestationType;
  date_prevue: string;
  prestataire_user_id?: string;
  horaire_prevu?: string;
  duree_estimee_min?: number;
  notes_intervention?: string;
  client_price_ht?: number;
  client_vat_rate?: number;
  provider_price?: number;
  currency?: string;
  laundry_included?: boolean;
  laundry_client_price_ht?: number;
  laundry_provider_price?: number;
}

export function useCreateMenage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMenageInput) =>
      apiFetch<MenageDetail>(`/menages`, { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    },
  });
}

export interface LogementPrestataireMember {
  user_id: string;
  role: string;
  first_name: string;
  last_name: string;
  email: string;
}

export function useLogementPrestataires(logementId: string | undefined) {
  return useQuery({
    queryKey: ["logement-prestataires", logementId],
    queryFn: () =>
      apiFetch<{ data: LogementPrestataireMember[] }>(
        `/logement-members/by-logement?logement_id=${logementId}&limit=100`,
      ).then((r) => r.data.filter((m) => m.role === "prestataire")),
    enabled: !!logementId,
  });
}
