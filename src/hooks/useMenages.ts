"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { CalendarMenage } from "./useCalendarMenages";

export type MenageStatus = CalendarMenage["status"];
export type MenageFilter = MenageStatus | "all" | "to_validate" | "unassigned";

interface ApiResponse {
  data: CalendarMenage[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

interface Params {
  status?: MenageStatus;
  validated?: boolean;
  unassigned?: boolean;
  logement_id?: string;
  prestataire_user_id?: string;
  managerOnly?: boolean;
  page?: number;
  limit?: number;
}

export function useMenages(params: Params = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.validated !== undefined) qs.set("validated", String(params.validated));
  if (params.unassigned !== undefined) qs.set("unassigned", String(params.unassigned));
  if (params.logement_id) qs.set("logement_id", params.logement_id);
  if (params.prestataire_user_id) qs.set("prestataire_user_id", params.prestataire_user_id);
  if (params.managerOnly) qs.set("manager", "me");
  qs.set("limit", String(params.limit ?? 100));
  if (params.page) qs.set("page", String(params.page));

  return useQuery({
    queryKey: ["menages", params],
    queryFn: () => apiFetch<ApiResponse>(`/menages?${qs.toString()}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
