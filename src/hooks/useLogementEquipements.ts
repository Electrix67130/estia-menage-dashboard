"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type EquipementCategory =
  | "cuisine"
  | "electromenager"
  | "confort"
  | "exterieur"
  | "loisirs"
  | "bebe"
  | "securite"
  | "autre";

export interface LogementEquipement {
  id: string;
  logement_id: string;
  logement_room_id: string | null;
  label: string;
  category: EquipementCategory | null;
  quantity: number;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  /** Joint côté API depuis `logement_room`. */
  room_name?: string | null;
}

export interface EquipementCatalogCategory {
  key: EquipementCategory;
  label: string;
  suggestions: string[];
}

const KEY = ["logement-equipements"] as const;
const CATALOG_KEY = ["logement-equipements", "catalog"] as const;

export function useLogementEquipements(logementId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, logementId],
    queryFn: () =>
      apiFetch<LogementEquipement[]>(`/logement-equipements?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

/** Catalogue de suggestions servi par l'API (même liste que sur mobile). */
export function useEquipementCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: () =>
      apiFetch<{ categories: EquipementCatalogCategory[] }>(`/logement-equipements/catalog`),
    staleTime: 60 * 60 * 1000, // statique : inutile de le refetch souvent
  });
}

export interface CreateEquipementInput {
  logement_id: string;
  label: string;
  category?: EquipementCategory;
  quantity?: number;
  logement_room_id?: string | null;
  notes?: string | null;
}

export function useCreateEquipement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEquipementInput) =>
      apiFetch<LogementEquipement>(`/logement-equipements`, { method: "POST", body: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.logement_id] });
    },
  });
}

/** Ajout groupé depuis le catalogue (idempotent côté API). */
export function useBulkCreateEquipements(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { label: string; category?: EquipementCategory }[]) =>
      apiFetch<LogementEquipement[]>(`/logement-equipements/bulk`, {
        method: "POST",
        body: { logement_id: logementId, items },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, logementId] });
    },
  });
}

export function useUpdateEquipement(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateEquipementInput> }) =>
      apiFetch<LogementEquipement>(`/logement-equipements/${id}`, {
        method: "PATCH",
        body: input,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, logementId] });
    },
  });
}

export function useDeleteEquipement(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/logement-equipements/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, logementId] });
    },
  });
}
