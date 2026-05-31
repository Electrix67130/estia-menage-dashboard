import { apiFetch } from "./api";
import type { PaginatedResponse } from "@/types/api";

export interface AdminOverview {
  orgs: { total: number; active: number };
  users: { total: number; active: number };
  menages: { active: number; archived: number };
  billing: { billable_seats: number; estimated_monthly_eur: number };
  recent_orgs: { id: string; name: string; created_at: string }[];
  recent_users: { id: string; email: string; first_name: string; last_name: string; created_at: string }[];
}

export interface AdminOrg {
  id: string;
  name: string;
  is_active: boolean;
  archive_retention_years: number;
  created_at: string;
  member_count: number;
  menage_count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  super_admin_id: string;
  super_admin_email: string;
  super_admin_first_name: string;
  super_admin_last_name: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

export interface ErrorEntry {
  id: string;
  level: "error" | "warn";
  message: string;
  stack: string | null;
  route: string | null;
  method: string | null;
  user_id: string | null;
  user_email: string | null;
  status_code: number | null;
  request_id: string | null;
  created_at: string;
}

export const adminApi = {
  overview: () => apiFetch<AdminOverview>("/super-admin/overview"),
  orgs: (q?: string, page = 1) =>
    apiFetch<PaginatedResponse<AdminOrg>>(
      `/super-admin/orgs?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    ),
  org: (id: string) => apiFetch<AdminOrg & { members: unknown[]; menages: unknown[] }>(`/super-admin/orgs/${id}`),
  enableOrg: (id: string) => apiFetch(`/super-admin/orgs/${id}/enable`, { method: "POST" }),
  disableOrg: (id: string) => apiFetch(`/super-admin/orgs/${id}/disable`, { method: "POST" }),
  impersonate: (id: string) =>
    apiFetch<{ access_token: string; user_id: string }>(`/super-admin/orgs/${id}/impersonate`, {
      method: "POST",
    }),

  users: (q?: string, page = 1) =>
    apiFetch<PaginatedResponse<AdminUser>>(
      `/super-admin/users?page=${page}${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    ),
  user: (id: string) =>
    apiFetch<AdminUser & { memberships: unknown[]; active_sessions: number }>(`/super-admin/users/${id}`),
  enableUser: (id: string) => apiFetch(`/super-admin/users/${id}/enable`, { method: "POST" }),
  disableUser: (id: string) => apiFetch(`/super-admin/users/${id}/disable`, { method: "POST" }),
  kickSessions: (id: string) =>
    apiFetch<{ sessions_killed: number }>(`/super-admin/users/${id}/kick-sessions`, { method: "POST" }),
  forceReset: (id: string) =>
    apiFetch<{ temporary_password: string }>(`/super-admin/users/${id}/force-reset`, { method: "POST" }),
  deleteUser: (id: string) => apiFetch(`/super-admin/users/${id}`, { method: "DELETE" }),

  audit: (page = 1) => apiFetch<PaginatedResponse<AuditEntry>>(`/super-admin/audit?page=${page}`),
  errors: (page = 1) => apiFetch<PaginatedResponse<ErrorEntry>>(`/super-admin/errors?page=${page}`),
};
