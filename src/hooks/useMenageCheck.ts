"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface MenageCheckItem {
  id: string;
  section_id: string;
  item_label: string;
  position: number;
  validated_at: string | null;
  validated_by: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface MenageCheckSection {
  id: string;
  menage_id: string;
  section_type: string;
  section_label: string;
  position: number;
  items: MenageCheckItem[];
}

export function useMenageCheck(menageId: string | undefined) {
  return useQuery({
    queryKey: ["menage-check", menageId],
    queryFn: () => apiFetch<MenageCheckSection[]>(`/menages/${menageId}/check`),
    enabled: !!menageId,
  });
}

export interface MenagePhoto {
  id: string;
  menage_id: string | null;
  section_id: string | null;
  logement_id: string | null;
  logement_room_id: string | null;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  taken_at: string;
  uploaded_by: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
}

interface PhotoResponse {
  data: MenagePhoto[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useMenagePhotos(menageId: string | undefined) {
  return useQuery({
    queryKey: ["menage-photos", menageId],
    queryFn: () => apiFetch<PhotoResponse>(`/photos?menage_id=${menageId}&limit=100`),
    enabled: !!menageId,
  });
}

export interface Comment {
  id: string;
  menage_id: string;
  section_id: string | null;
  author_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
}

interface CommentResponse {
  data: Comment[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useMenageComments(menageId: string | undefined) {
  return useQuery({
    queryKey: ["menage-comments", menageId],
    // order=asc : plus anciens en haut, derniers en bas (style discussion,
    // cohérent avec l'app mobile).
    queryFn: () => apiFetch<CommentResponse>(`/comments?menage_id=${menageId}&limit=100&order=asc`),
    enabled: !!menageId,
  });
}

export function useCreateComment(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { content: string; section_id?: string }) =>
      apiFetch<Comment>(`/comments`, {
        method: "POST",
        body: { menage_id: menageId, ...input },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menage-comments", menageId] });
    },
  });
}

export function useValidateMenage(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (price?: number) =>
      apiFetch(`/menages/${menageId}/validate`, {
        method: "POST",
        body: price !== undefined ? { price } : {},
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menage-detail", menageId] });
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    },
  });
}

export function useDeleteMenage(menageId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<void>(`/menages/${menageId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
      qc.invalidateQueries({ queryKey: ["menage-detail", menageId] });
    },
  });
}
