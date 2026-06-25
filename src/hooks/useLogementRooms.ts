"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type RoomKind =
  | "chambre"
  | "salle_de_bain"
  | "wc"
  | "cuisine"
  | "salon"
  | "salle_a_manger"
  | "bureau"
  | "entree"
  | "couloir"
  | "exterieur"
  | "cave"
  | "buanderie"
  | "autre";

export interface LogementRoom {
  id: string;
  logement_id: string;
  name: string;
  kind: RoomKind | null;
  position: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = ["logement-rooms"] as const;

export function useLogementRooms(logementId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, logementId],
    queryFn: () =>
      apiFetch<LogementRoom[]>(`/logement-rooms?logement_id=${logementId}`),
    enabled: !!logementId,
  });
}

export function useCreateLogementRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      logement_id: string;
      kind: RoomKind;
      name?: string;
      position?: number;
      notes?: string;
    }) => apiFetch<LogementRoom>(`/logement-rooms`, { method: "POST", body: input }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.logement_id] });
    },
  });
}

export function useUpdateLogementRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<LogementRoom> }) =>
      apiFetch<LogementRoom>(`/logement-rooms/${id}`, { method: "PATCH", body: input }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: [...KEY, data.logement_id] });
    },
  });
}

export function useDeleteLogementRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; logement_id: string }) =>
      apiFetch<void>(`/logement-rooms/${id}`, { method: "DELETE" }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...KEY, vars.logement_id] });
    },
  });
}
