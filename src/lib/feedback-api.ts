import { apiFetch } from "@/lib/api";
import type { PaginatedResponse } from "@/types/api";

/** Bugs et suggestions. Les signalements de contenu vivent désormais dans `/reports`. */
export type FeedbackType = "bug" | "suggestion";
export type FeedbackStatus = "new" | "in_progress" | "resolved" | "declined";

export interface Feedback {
  id: string;
  user_id: string;
  organization_id: string | null;
  type: FeedbackType;
  subject: string;
  message: string;
  status: FeedbackStatus;
  platform: "mobile" | "web" | null;
  app_version: string | null;
  screen: string | null;
  locale: string;
  /** Réponse de l'admin. Nulle tant que personne n'a répondu. */
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Signalement enrichi de son auteur, tel que le voit la console admin. */
export interface FeedbackWithAuthor extends Feedback {
  author_email: string | null;
  author_first_name: string | null;
  author_last_name: string | null;
  responder_first_name: string | null;
  responder_last_name: string | null;
  /** Renseigné par les vues super admin, qui traversent les organisations. */
  organization_name?: string | null;
}

export interface CreateFeedbackInput {
  type: FeedbackType;
  subject: string;
  message: string;
  platform?: "mobile" | "web";
  app_version?: string;
  screen?: string;
  locale?: string;
}

export interface FeedbackFilters {
  page?: number;
  status?: FeedbackStatus;
  type?: FeedbackType;
  q?: string;
}

/** Réponse de la console : la liste, plus le compte par statut pour les onglets. */
export type FeedbackListResponse = PaginatedResponse<FeedbackWithAuthor> & {
  counts: Partial<Record<FeedbackStatus, number>>;
};

export const feedbackApi = {
  /** Déposer un bug ou une suggestion. */
  create: (input: CreateFeedbackInput) =>
    apiFetch<Feedback>("/feedbacks", { method: "POST", body: input }),

  /** Ses propres signalements, avec les réponses reçues. */
  mine: (page = 1) => apiFetch<PaginatedResponse<Feedback>>(`/feedbacks/mine?page=${page}`),

  /** Les signalements de l'organisation — admin uniquement (403 sinon). */
  list: (filters: FeedbackFilters = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(filters.page ?? 1));
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.q) params.set("q", filters.q);
    return apiFetch<FeedbackListResponse>(`/feedbacks?${params.toString()}`);
  },

  /**
   * Traite un signalement. Écrire une réponse le passe à `resolved` côté API,
   * sauf si un statut est précisé explicitement.
   */
  respond: (id: string, patch: { status?: FeedbackStatus; response?: string | null }) =>
    apiFetch<Feedback>(`/feedbacks/${id}`, { method: "PATCH", body: patch }),
};

/**
 * Console **super admin** : les signalements de TOUTES les organisations.
 * Réservée au porteur du produit (`user.is_super_admin`) — l'API renvoie 403
 * aux autres. La console d'organisation, elle, passe par `feedbackApi.list`.
 */
export const feedbackSupportApi = {
  list: (filters: FeedbackFilters = {}) => {
    const params = new URLSearchParams();
    params.set("page", String(filters.page ?? 1));
    if (filters.status) params.set("status", filters.status);
    if (filters.type) params.set("type", filters.type);
    if (filters.q) params.set("q", filters.q);
    return apiFetch<FeedbackListResponse>(`/super-admin/feedbacks?${params.toString()}`);
  },

  get: (id: string) => apiFetch<FeedbackWithAuthor>(`/super-admin/feedbacks/${id}`),

  respond: (id: string, patch: { status?: FeedbackStatus; response?: string | null }) =>
    apiFetch<Feedback>(`/super-admin/feedbacks/${id}`, { method: "PATCH", body: patch }),
};
