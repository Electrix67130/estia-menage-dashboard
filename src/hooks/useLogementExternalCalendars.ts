"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type ExternalCalendarProvider = "airbnb" | "booking" | "vrbo" | "ical";

export interface ExternalCalendar {
  id: string;
  logement_id: string;
  provider: ExternalCalendarProvider;
  label: string | null;
  url: string;
  enabled: boolean;
  last_synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncResult {
  fetched_events: number;
  created_menages: number;
  updated_menages: number;
  cancelled_menages: number;
  error?: string;
  calendar: ExternalCalendar;
}

/** Calendriers iCal externes (Airbnb/Booking/Vrbo/iCal) rattachés à un logement. Admin only. */
export function useLogementExternalCalendars(logementId: string | undefined) {
  return useQuery({
    queryKey: ["logement-external-calendars", logementId],
    queryFn: () =>
      apiFetch<{ data: ExternalCalendar[] }>(
        `/logement-external-calendars?logement_id=${logementId}`,
      ).then((r) => r.data),
    enabled: !!logementId,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, logementId: string) {
  qc.invalidateQueries({ queryKey: ["logement-external-calendars", logementId] });
}

export interface CreateExternalCalendarInput {
  logement_id: string;
  url: string;
  provider?: ExternalCalendarProvider;
  label?: string;
  enabled?: boolean;
}

export function useCreateExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateExternalCalendarInput) =>
      apiFetch<ExternalCalendar>(`/logement-external-calendars`, { method: "POST", body }),
    onSuccess: (_d, vars) => invalidate(qc, vars.logement_id),
  });
}

export interface UpdateExternalCalendarInput {
  id: string;
  logement_id: string;
  provider?: ExternalCalendarProvider;
  label?: string | null;
  url?: string;
  enabled?: boolean;
}

export function useUpdateExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, logement_id: _logementId, ...body }: UpdateExternalCalendarInput) =>
      apiFetch<ExternalCalendar>(`/logement-external-calendars/${id}`, { method: "PATCH", body }),
    onSuccess: (_d, vars) => invalidate(qc, vars.logement_id),
  });
}

export function useDeleteExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; logement_id: string }) =>
      apiFetch(`/logement-external-calendars/${id}`, { method: "DELETE" }),
    onSuccess: (_d, vars) => invalidate(qc, vars.logement_id),
  });
}

export function useSyncExternalCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; logement_id: string }) =>
      apiFetch<SyncResult>(`/logement-external-calendars/${id}/sync`, { method: "POST" }),
    onSuccess: (_d, vars) => invalidate(qc, vars.logement_id),
  });
}
