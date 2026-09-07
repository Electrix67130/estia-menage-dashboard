"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** Option proposée au client sur un logement (pack romantique, anniversaire…). */
export interface LogementOption {
  id: string;
  logement_id: string;
  label: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

/** Option retenue par le client pour une prestation donnée. */
export interface MenageOption {
  id: string;
  menage_id: string;
  logement_option_id: string;
  notes: string | null;
  label: string;
  description: string | null;
}

const KEY = ["logement-options"] as const;
const MENAGE_KEY = ["menage-options"] as const;

export function useLogementOptions(logementId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, logementId],
    queryFn: () => apiFetch<LogementOption[]>(`/logement-options?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

/** Packs suggérés à la saisie (mêmes libellés que sur mobile). */
export function useOptionSuggestions() {
  return useQuery({
    queryKey: [...KEY, "suggestions"],
    queryFn: () => apiFetch<{ labels: string[] }>(`/logement-options/suggestions`),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCreateLogementOption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { logement_id: string; label: string; description?: string | null }) =>
      apiFetch<LogementOption>(`/logement-options`, { method: "POST", body: input }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: [...KEY, vars.logement_id] }),
  });
}

export function useUpdateLogementOption(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { label?: string; description?: string | null };
    }) => apiFetch<LogementOption>(`/logement-options/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useDeleteLogementOption(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/logement-options/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...KEY, logementId] }),
  });
}

export function useMenageOptions(menageId: string | undefined) {
  return useQuery({
    queryKey: [...MENAGE_KEY, menageId],
    queryFn: () => apiFetch<MenageOption[]>(`/menages/${menageId}/options`),
    enabled: !!menageId,
  });
}

/** Définit les options retenues pour une prestation (admin). */
export function useSetMenageOptions(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: { logement_option_id: string; notes?: string | null }[]) =>
      apiFetch<MenageOption[]>(`/menages/${menageId}/options`, { method: "PUT", body: { items } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MENAGE_KEY, menageId] }),
  });
}
