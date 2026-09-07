"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface LogementCode {
  id: string;
  logement_id: string;
  label: string;
  code: string;
  notes: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

const KEY = ["logement-codes"] as const;

/**
 * Codes d'accès d'un logement (boîte à clés, portail, alarme…). Lisible par
 * l'admin, les membres du logement et les prestas affectés à un de ses ménages.
 */
export function useLogementCodes(logementId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, logementId],
    queryFn: () => apiFetch<LogementCode[]>(`/logement-codes?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

/** Libellés proposés à la saisie (mêmes chips que sur mobile). */
export function useCodeLabelSuggestions() {
  return useQuery({
    queryKey: [...KEY, "label-suggestions"],
    queryFn: () => apiFetch<{ labels: string[] }>(`/logement-codes/label-suggestions`),
    staleTime: 60 * 60 * 1000,
  });
}

export interface CreateLogementCodeInput {
  logement_id: string;
  label: string;
  code: string;
  notes?: string | null;
}

export function useCreateLogementCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLogementCodeInput) =>
      apiFetch<LogementCode>(`/logement-codes`, { method: "POST", body: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.logement_id] });
    },
  });
}

export function useUpdateLogementCode(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CreateLogementCodeInput> }) =>
      apiFetch<LogementCode>(`/logement-codes/${id}`, { method: "PATCH", body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, logementId] });
    },
  });
}

export function useDeleteLogementCode(logementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/logement-codes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...KEY, logementId] });
    },
  });
}
