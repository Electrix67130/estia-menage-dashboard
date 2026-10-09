import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { PaginatedResponse } from "@/types/api";

/** Signalements de contenu (`/reports`, repris de Buildr). */
export type ReportTarget = "comment" | "photo" | "user";
export const REPORT_REASONS = ["inappropriate", "harassment", "off_topic", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface Report {
  id: string;
  organization_id: string;
  menage_id: string | null;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  target_user_id: string | null;
  /** Contenu figé au moment du signalement (le message peut avoir été supprimé). */
  target_excerpt: string | null;
  reason: ReportReason;
  comment: string | null;
  status: ReportStatus;
  /** La personne visée est admin : le signalement remonte aussi à la console. */
  escalated: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  reporter_first_name: string;
  reporter_last_name: string;
  target_first_name: string | null;
  target_last_name: string | null;
  logement_name: string | null;
  menage_date: string | null;
  organization_name: string;
  target_exists: boolean;
}

export type ReportsPage = PaginatedResponse<Report> & { counts: { pending: number } };

export interface ReportFilters {
  status?: ReportStatus | "";
  menage_id?: string;
  escalated?: boolean;
  organization_id?: string;
  page?: number;
}

export interface CreateReportInput {
  target_type: ReportTarget;
  target_id: string;
  reason: ReportReason;
  comment?: string;
}

export function reportsQuery(filters: ReportFilters): string {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", "50");
  if (filters.status) params.set("status", filters.status);
  if (filters.menage_id) params.set("menage_id", filters.menage_id);
  if (filters.escalated) params.set("escalated", "1");
  if (filters.organization_id) params.set("organization_id", filters.organization_id);
  return params.toString();
}

/** Signaler un message, une photo ou un membre aux admins de l'organisation. */
export function useCreateReport() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => apiFetch<Report>("/reports", { method: "POST", body: input }),
  });
}

/** Les signalements de son organisation (administrateurs). */
export function useReports(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: ["reports", "org", filters],
    queryFn: () => apiFetch<ReportsPage>(`/reports?${reportsQuery(filters)}`),
    enabled,
  });
}

/** Tous les signalements, pour la console super admin. */
export function useAllReports(filters: ReportFilters, enabled = true) {
  return useQuery({
    queryKey: ["reports", "all", filters],
    queryFn: () => apiFetch<ReportsPage>(`/super-admin/reports?${reportsQuery(filters)}`),
    enabled,
  });
}

/** Nombre de signalements en attente, pour la pastille du menu. */
export function usePendingReportsCount(enabled: boolean) {
  return useQuery({
    queryKey: ["reports", "org", "pending-count"],
    queryFn: () => apiFetch<ReportsPage>("/reports?status=pending&limit=1"),
    enabled,
    select: (d) => d.counts.pending,
    refetchInterval: 60_000,
  });
}
