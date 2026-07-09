"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type MenageTab =
  | "comments"
  | "comments_steps"
  | "photos"
  | "documents"
  | "emergencies"
  | "emergencies_claim";

export interface UnreadCounts {
  comments: number;
  comments_steps: number;
  photos: number;
  documents: number;
  emergencies: number;
  emergencies_claim: number;
  unread_step_ids: string[];
  unread_emergency_ids: string[];
}

export function useUnreadCounts(menageId?: string) {
  return useQuery({
    queryKey: ["menage-views", "unread", menageId],
    queryFn: () => apiFetch<UnreadCounts>(`/menage-views/unread?menage_id=${menageId}`),
    enabled: !!menageId,
    refetchInterval: 60000,
  });
}

export interface UnreadSummary {
  by_menage: Record<string, number>;
  by_organization: Record<string, number>;
  /** Totaux ventilés par type de prestation (menage / check_in / check_out). */
  by_type: Record<string, number>;
}

export function useUnreadSummary(enabled: boolean = true) {
  return useQuery({
    queryKey: ["menage-views", "unread-summary"],
    queryFn: () => apiFetch<UnreadSummary>("/menage-views/unread-summary"),
    enabled,
    refetchInterval: 60000,
  });
}

export function useMarkItemViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ item_type, item_id }: { item_type: "step" | "emergency"; item_id: string }) =>
      apiFetch<void>("/menage-views/item", {
        method: "POST",
        body: { item_type, item_id },
      }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["menage-views"] });
    },
  });
}

export function useMarkTabViewed() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ menage_id, tab }: { menage_id: string; tab: MenageTab }) =>
      apiFetch<void>("/menage-views", {
        method: "POST",
        body: { menage_id, tab },
      }),
    onMutate: async ({ menage_id, tab }) => {
      await qc.cancelQueries({ queryKey: ["menage-views", "unread", menage_id] });
      await qc.cancelQueries({ queryKey: ["menage-views", "unread-summary"] });

      const prevUnread = qc.getQueryData<UnreadCounts>([
        "menage-views",
        "unread",
        menage_id,
      ]);
      const prevSummary = qc.getQueryData<UnreadSummary>(["menage-views", "unread-summary"]);

      const tabCount = prevUnread?.[tab] ?? 0;

      if (prevUnread) {
        qc.setQueryData<UnreadCounts>(["menage-views", "unread", menage_id], {
          ...prevUnread,
          [tab]: 0,
        });
      }

      if (prevSummary && tabCount > 0) {
        const currentMenageTotal = prevSummary.by_menage[menage_id] ?? 0;
        const newMenageTotal = Math.max(0, currentMenageTotal - tabCount);
        const next: UnreadSummary = {
          by_menage: { ...prevSummary.by_menage },
          by_organization: { ...prevSummary.by_organization },
          // Report tel quel : le refetch de onSettled corrige le détail par type.
          by_type: { ...prevSummary.by_type },
        };
        if (newMenageTotal === 0) delete next.by_menage[menage_id];
        else next.by_menage[menage_id] = newMenageTotal;
        qc.setQueryData<UnreadSummary>(["menage-views", "unread-summary"], next);
      }

      return { prevUnread, prevSummary };
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prevUnread) {
        qc.setQueryData(["menage-views", "unread", vars.menage_id], ctx.prevUnread);
      }
      if (ctx?.prevSummary) {
        qc.setQueryData(["menage-views", "unread-summary"], ctx.prevSummary);
      }
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: ["menage-views", "unread", vars.menage_id] });
      qc.invalidateQueries({ queryKey: ["menage-views", "unread-summary"] });
    },
  });
}
