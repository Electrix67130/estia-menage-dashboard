"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** Ligne renvoyée par GET /logement-consommables (config + stock courant). */
export interface ConsommableLine {
  logement_consommable_id: string;
  label: string;
  unit: string | null;
  seuil_alerte: number;
  position: number;
  qty: number | null; // stock courant (dernier relevé), null si jamais relevé
  recorded_at: string | null;
  needs_restock: boolean;
}

const KEY = ["logement-consommables"] as const;

export function useLogementConsommables(logementId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, logementId],
    queryFn: () =>
      apiFetch<ConsommableLine[]>(`/logement-consommables?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

export function useCreateConsommable() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      logement_id: string;
      label: string;
      unit?: string | null;
      seuil_alerte?: number;
      position?: number;
    }) => apiFetch(`/logement-consommables`, { method: "POST", body: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.logement_id] });
      qc.invalidateQueries({ queryKey: ["logements-list"] });
    },
  });
}

export function useUpdateConsommable(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { label?: string; unit?: string | null; seuil_alerte?: number; position?: number };
    }) => apiFetch(`/logement-consommables/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, logementId] });
      qc.invalidateQueries({ queryKey: ["logements-list"] });
    },
  });
}

export function useDeleteConsommable(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/logement-consommables/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, logementId] });
      qc.invalidateQueries({ queryKey: ["logements-list"] });
    },
  });
}

/** Relevé de consommables d'un ménage précis (lecture — affichage dashboard). */
export function useMenageConsommables(menageId: string | undefined) {
  return useQuery({
    queryKey: ["menage-consommables", menageId],
    queryFn: () => apiFetch<ConsommableLine[]>(`/menages/${menageId}/consommables`),
    enabled: !!menageId,
  });
}
