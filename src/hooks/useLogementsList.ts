"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export interface LogementListItem {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  client_id: string | null;
  cover_photo_url: string | null;
  color: string | null;
  archived_at: string | null;
}

interface ApiResponse {
  data: LogementListItem[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export function useLogementsList() {
  return useQuery({
    queryKey: ["logements-list"],
    queryFn: () => apiFetch<ApiResponse>(`/logements?limit=500`),
    staleTime: 60_000,
  });
}
