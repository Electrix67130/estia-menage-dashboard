"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  Client,
  CreateClientInput,
  PaginatedResponse,
  UpdateClientInput,
} from "@/types/api";

const CLIENTS_KEY = ["clients"] as const;

export function useClients(params: { page?: number; limit?: number; search?: string } = {}) {
  const search = params.search?.trim();
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  if (search) qs.set("search", search);
  const query = qs.toString();
  return useQuery({
    queryKey: [...CLIENTS_KEY, params.page ?? 1, params.limit ?? 20, search ?? ""],
    queryFn: () =>
      apiFetch<PaginatedResponse<Client>>(`/clients${query ? `?${query}` : ""}`),
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, "detail", id],
    queryFn: () => apiFetch<Client>(`/clients/${id}`),
    enabled: !!id,
  });
}

export function useClientLogements(clientId: string | undefined) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, clientId, "logements"],
    queryFn: () => apiFetch<unknown[]>(`/clients/${clientId}/logements`),
    enabled: !!clientId,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClientInput) =>
      apiFetch<Client>(`/clients`, { method: "POST", body: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateClientInput }) =>
      apiFetch<Client>(`/clients/${id}`, { method: "PATCH", body: input }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
      queryClient.invalidateQueries({ queryKey: [...CLIENTS_KEY, "detail", vars.id] });
    },
  });
}

export interface ReportPrestataire {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ReportMenage {
  id: string;
  date_prevue: string;
  date_realisation: string | null;
  horaire_prevu: string | null;
  duree_estimee_min: number | null;
  status: "a_venir" | "en_cours" | "termine" | "valide";
  external_source: string | null;
  currency: string;
  prix_prevu: string | null;
  client_price_ht: string | null;
  client_vat_rate: string | null;
  validated_price: string | null;
  provider_price: string | null;
  laundry_included: boolean;
  laundry_client_price_ht: string | null;
  laundry_provider_price: string | null;
  logement_id: string;
  logement_name: string | null;
  logement_address: string | null;
  logement_city: string | null;
  logement_color: string | null;
  referent_first_name: string | null;
  referent_last_name: string | null;
  prestataires: ReportPrestataire[];
}

export interface ClientReport {
  client: Client;
  period: { from: string; to: string };
  menages: ReportMenage[];
}

export function useClientReport(clientId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: [...CLIENTS_KEY, clientId, "report", from, to],
    queryFn: () =>
      apiFetch<ClientReport>(`/clients/${clientId}/report?from=${from}&to=${to}`),
    enabled: !!clientId && !!from && !!to,
  });
}

export function useArchiveClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/clients/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLIENTS_KEY });
    },
  });
}
