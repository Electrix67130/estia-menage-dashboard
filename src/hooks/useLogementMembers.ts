"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse, User } from "@/types/api";

/** Tous les prestataires de l'organisation (pour les rattacher à un logement). */
export function useOrgPrestataires() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<PaginatedResponse<User>>("/users?limit=100"),
    select: (r) => r.data.filter((u) => u.role === "prestataire"),
  });
}

export interface LogementMember {
  id: string;
  user_id: string;
  role: "manager" | "prestataire" | "client_proprietaire";
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string | null;
}

/** Membres d'un logement (avec l'id du rattachement, nécessaire au retrait). */
export function useLogementMembers(logementId: string | undefined) {
  return useQuery({
    queryKey: ["logement-members", logementId],
    queryFn: () =>
      apiFetch<{ data: LogementMember[] }>(
        `/logement-members/by-logement?logement_id=${logementId}&limit=100`,
      ).then((r) => r.data),
    enabled: !!logementId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, logementId: string) {
  qc.invalidateQueries({ queryKey: ["logement-members", logementId] });
  qc.invalidateQueries({ queryKey: ["logement-prestataires", logementId] });
}

export function useAddLogementMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { logement_id: string; user_id: string; role: LogementMember["role"] }) =>
      apiFetch(`/logement-members`, { method: "POST", body }),
    onSuccess: (_d, vars) => invalidate(qc, vars.logement_id),
  });
}

export function useRemoveLogementMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; logement_id: string }) =>
      apiFetch(`/logement-members/${id}`, { method: "DELETE" }),
    onSuccess: (_d, vars) => invalidate(qc, vars.logement_id),
  });
}
