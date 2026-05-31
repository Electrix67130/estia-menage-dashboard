"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface LogementPhoto {
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
  data: LogementPhoto[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useLogementPhotos(logementId: string | undefined, logementRoomId?: string) {
  const qs = new URLSearchParams();
  if (logementId) qs.set("logement_id", logementId);
  if (logementRoomId) qs.set("logement_room_id", logementRoomId);
  qs.set("limit", "200");
  return useQuery({
    queryKey: ["logement-photos", logementId, logementRoomId ?? null],
    queryFn: () => apiFetch<PhotoResponse>(`/photos?${qs.toString()}`),
    enabled: !!logementId,
  });
}

export interface CreatePhotoInput {
  logement_id?: string;
  logement_room_id?: string;
  menage_id?: string;
  url: string;
  thumbnail_url?: string;
  caption?: string;
  taken_at: string;
  file_size?: number;
  mime_type?: string;
}

export function useCreatePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePhotoInput) =>
      apiFetch<LogementPhoto>(`/photos`, { method: "POST", body: input }),
    onSuccess: (_data, vars) => {
      if (vars.logement_id) {
        qc.invalidateQueries({ queryKey: ["logement-photos", vars.logement_id] });
      }
      if (vars.menage_id) {
        qc.invalidateQueries({ queryKey: ["menage-photos", vars.menage_id] });
      }
    },
  });
}

export function useDeletePhoto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<void>(`/photos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["logement-photos"] });
      qc.invalidateQueries({ queryKey: ["menage-photos"] });
    },
  });
}
