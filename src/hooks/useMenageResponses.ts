"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type MenageResponseStatus = "present" | "absent";

export interface MenageResponse {
  id: string;
  menage_id: string;
  user_id: string;
  status: MenageResponseStatus;
  responded_at: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export function useMenageResponses(menageId: string | undefined) {
  return useQuery({
    queryKey: ["menage-responses", menageId],
    queryFn: () =>
      apiFetch<{ data: MenageResponse[] }>(`/menages/${menageId}/responses`).then(
        (r) => r.data,
      ),
    enabled: !!menageId,
    staleTime: 30_000,
  });
}

export interface PrestataireWeeklyAvailability {
  id: string;
  user_id: string;
  organization_id: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  created_at: string;
  updated_at: string;
}

export function useWeeklyAvailabilities(userIds: string[]) {
  return useQuery({
    queryKey: ["weekly-availability", userIds],
    queryFn: () =>
      apiFetch<{ data: PrestataireWeeklyAvailability[] }>(
        `/prestataires/weekly-availability?user_ids=${userIds.join(",")}`,
      ).then((r) => r.data),
    enabled: userIds.length > 0,
    staleTime: 60_000,
  });
}
