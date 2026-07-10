"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface Logement {
  id: string;
  organization_id: string;
  created_by: string;
  proprietaire_user_id: string | null;
  client_id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  n_bedrooms: number;
  n_bathrooms: number;
  n_wc: number;
  n_kitchens: number;
  n_living_rooms: number;
  n_exterior_spaces: number;
  n_lit_simple: number;
  n_lit_double: number;
  n_canape_lit: number;
  n_lit_appoint: number;
  has_basement: boolean;
  has_laundry: boolean;
  has_pool: boolean;
  has_jacuzzi: boolean;
  /** Active la création de prestations « check-in » (arrivée voyageur) pour ce logement. */
  enable_check_in: boolean;
  /** Active la création de prestations « check-out » (départ voyageur) pour ce logement. */
  enable_check_out: boolean;
  surface_m2: number | null;
  notes: string | null;
  /** Code de la boîte à clés (accès logement pour le presta affecté). */
  key_safe_code: string | null;
  /** Valeurs par défaut utilisées pour pré-remplir la création d'un ménage. */
  default_duration_min: number | null;
  default_client_price_ht: number | string | null;
  default_client_vat_rate: number | string | null;
  default_provider_price: number | string | null;
  default_laundry_included: boolean;
  default_laundry_client_price_ht: number | string | null;
  default_laundry_provider_price: number | string | null;
  default_horaire_debut: string | null;
  default_horaire_fin: string | null;
  color: string | null;
  /** Photo de couverture (URL signée renvoyée par l'API) affichée dans la liste. */
  cover_photo_url: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** Calculé API : nb de consommables sous le seuil (stock courant). 0 = OK. */
  consommables_alert?: number;
}

export interface UpdateLogementInput {
  name?: string;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  client_id?: string | null;
  n_bedrooms?: number;
  n_bathrooms?: number;
  n_wc?: number;
  n_kitchens?: number;
  n_living_rooms?: number;
  n_exterior_spaces?: number;
  n_lit_simple?: number;
  n_lit_double?: number;
  n_canape_lit?: number;
  n_lit_appoint?: number;
  has_basement?: boolean;
  has_laundry?: boolean;
  has_pool?: boolean;
  has_jacuzzi?: boolean;
  enable_check_in?: boolean;
  enable_check_out?: boolean;
  surface_m2?: number | null;
  notes?: string | null;
  key_safe_code?: string | null;
  default_duration_min?: number | null;
  default_client_price_ht?: number | null;
  default_client_vat_rate?: number | null;
  default_provider_price?: number | null;
  default_laundry_included?: boolean;
  default_laundry_client_price_ht?: number | null;
  default_laundry_provider_price?: number | null;
  default_horaire_debut?: string | null;
  default_horaire_fin?: string | null;
  color?: string | null;
  cover_photo_url?: string | null;
}

export function useLogement(id: string | undefined) {
  return useQuery({
    queryKey: ["logement", id],
    queryFn: () => apiFetch<Logement>(`/logements/${id}`),
    enabled: !!id,
  });
}

export function useUpdateLogement(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateLogementInput) =>
      apiFetch<Logement>(`/logements/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logement", id] });
      qc.invalidateQueries({ queryKey: ["logements-list"] });
    },
  });
}

export interface CreateLogementInput {
  name: string;
  client_id?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  n_bedrooms?: number;
  n_bathrooms?: number;
  n_wc?: number;
  n_kitchens?: number;
  n_living_rooms?: number;
  n_exterior_spaces?: number;
  n_lit_simple?: number;
  n_lit_double?: number;
  n_canape_lit?: number;
  n_lit_appoint?: number;
  has_basement?: boolean;
  has_laundry?: boolean;
  has_pool?: boolean;
  has_jacuzzi?: boolean;
  enable_check_in?: boolean;
  enable_check_out?: boolean;
  surface_m2?: number;
  notes?: string;
  key_safe_code?: string;
  default_duration_min?: number;
  default_client_price_ht?: number;
  default_client_vat_rate?: number;
  default_provider_price?: number;
  default_laundry_included?: boolean;
  default_laundry_client_price_ht?: number;
  default_laundry_provider_price?: number;
  default_horaire_debut?: string;
  default_horaire_fin?: string;
  color?: string;
}

export function useCreateLogement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLogementInput) =>
      apiFetch<Logement>(`/logements`, { method: "POST", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logements-list"] });
    },
  });
}

/** Supprime (archive) un logement — admin only. */
export function useDeleteLogement() {
  const qc = useQueryClient();
  return useMutation({
    // L'archivage est en cascade côté API : le logement + toutes ses prestations
    // (ménages/check-in/check-out) + ses consommables. Renvoie le nombre de
    // prestations archivées.
    mutationFn: (id: string) =>
      apiFetch<{ archived_menages: number }>(`/logements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logements-list"] });
      qc.invalidateQueries({ queryKey: ["logements-archived"] });
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    },
  });
}

/** Restaure un logement archivé (cascade inverse) — admin only. */
export function useUnarchiveLogement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ unarchived_menages: number }>(`/logements/${id}/unarchive`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logements-list"] });
      qc.invalidateQueries({ queryKey: ["logements-archived"] });
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    },
  });
}
