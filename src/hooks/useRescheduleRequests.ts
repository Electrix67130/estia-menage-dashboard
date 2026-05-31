"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type {
  PaginatedResponse,
  RescheduleRequest,
  RescheduleStatus,
} from "@/types/api";

const KEY = ["reschedule-requests"] as const;

interface ListParams {
  status?: RescheduleStatus;
  menage_id?: string;
  requested_by?: string;
  page?: number;
}

export function useRescheduleRequests(params: ListParams = {}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.menage_id) qs.set("menage_id", params.menage_id);
  if (params.requested_by) qs.set("requested_by", params.requested_by);
  if (params.page) qs.set("page", String(params.page));
  const query = qs.toString();
  return useQuery({
    queryKey: [
      ...KEY,
      params.status ?? "all",
      params.menage_id ?? "",
      params.requested_by ?? "",
      params.page ?? 1,
    ],
    queryFn: () =>
      apiFetch<PaginatedResponse<RescheduleRequest>>(
        `/reschedule-requests${query ? `?${query}` : ""}`,
      ),
  });
}

export function useDecideReschedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      decision,
      decision_reason,
      apply_to_menage,
    }: {
      id: string;
      decision: "approved" | "rejected";
      decision_reason?: string;
      apply_to_menage?: boolean;
    }) =>
      apiFetch<RescheduleRequest>(`/reschedule-requests/${id}/decide`, {
        method: "POST",
        body: { decision, decision_reason, apply_to_menage },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
