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

/**
 * Création d'une photo. Volontairement sans invalidation de cache : les envois
 * se font par lot (sélection multiple de fichiers), donc l'appelant crée les
 * photos une par une puis invalide UNE seule fois — au lieu d'un refetch de la
 * galerie par photo.
 */
export function createPhotoRequest(input: CreatePhotoInput): Promise<LogementPhoto> {
  return apiFetch<LogementPhoto>(`/photos`, { method: "POST", body: input });
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
