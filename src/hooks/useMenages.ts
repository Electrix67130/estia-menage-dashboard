"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { CalendarMenage } from "./useCalendarMenages";
import type { PrestationType } from "@/lib/prestation";

export type MenageStatus = CalendarMenage["status"];
export type MenageFilter = MenageStatus | "all" | "to_validate" | "unassigned" | "past";

interface ApiResponse {
  data: CalendarMenage[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Params {
  status?: MenageStatus;
  /** Filtre par type de prestation (ménage / check-in / check-out). */
  type?: PrestationType;
  validated?: boolean;
  unassigned?: boolean;
  closed?: boolean;
  logement_id?: string;
  prestataire_user_id?: string;
  from?: string;
  to?: string;
  /** Avec `closed: true` : inclut aussi les non clôturées dont la date est
   *  antérieure (les « oubliées » de l'Historique). */
  stale_before?: string;
  managerOnly?: boolean;
  /** 'me' = uniquement les prestations où l'utilisateur est affecté (référent OU
   *  co-presta). Historique presta : ne voir que ce qu'il a réellement fait. */
  assigned?: "me";
  page?: number;
  limit?: number;
}

export function useMenages(params: Params = {}, options?: { enabled?: boolean }) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.type) qs.set("type", params.type);
  if (params.validated !== undefined) qs.set("validated", String(params.validated));
  if (params.unassigned !== undefined) qs.set("unassigned", String(params.unassigned));
  if (params.closed !== undefined) qs.set("closed", String(params.closed));
  if (params.logement_id) qs.set("logement_id", params.logement_id);
  if (params.prestataire_user_id) qs.set("prestataire_user_id", params.prestataire_user_id);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.stale_before) qs.set("stale_before", params.stale_before);
  if (params.managerOnly) qs.set("manager", "me");
  if (params.assigned) qs.set("assigned", params.assigned);
  qs.set("limit", String(params.limit ?? 100));
  if (params.page) qs.set("page", String(params.page));

  return useQuery({
    queryKey: ["menages", params],
    queryFn: () => apiFetch<ApiResponse>(`/menages?${qs.toString()}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}
