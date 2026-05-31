"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { MapPin } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useLogementsList } from "@/hooks/useLogementsList";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch, ApiError } from "@/lib/api";

// Leaflet manipule `window` → désactive le SSR.
const LogementsMap = dynamic(() => import("@/components/LogementsMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
      Chargement de la carte…
    </div>
  ),
});

interface BackfillResult {
  total: number;
  geocoded: number;
  failed: { id: string; name: string }[];
}

export default function MapPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const qc = useQueryClient();
  const logements = useLogementsList();
  const items = logements.data?.data ?? [];

  const geoStats = useMemo(() => {
    const total = items.length;
    const located = items.filter((l) => l.latitude !== null && l.longitude !== null).length;
    return { total, located, missing: total - located };
  }, [items]);

  const backfill = useMutation({
    mutationFn: () =>
      apiFetch<BackfillResult>("/logements/geocode-missing", { method: "POST" }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["logements-list"] });
      if (data.geocoded === data.total) {
        toast.success(`${data.geocoded} logement(s) géolocalisé(s)`);
      } else {
        toast.message(
          `${data.geocoded}/${data.total} géolocalisés — ${data.failed.length} adresse(s) introuvable(s)`,
        );
      }
    },
    onError: (err) => {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MapPin size={24} className="text-zinc-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Carte des logements</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {logements.isLoading
                ? "Chargement…"
                : `${geoStats.located} logement${geoStats.located > 1 ? "s" : ""} géolocalisé${geoStats.located > 1 ? "s" : ""}`}
              {geoStats.missing > 0 ? ` · ${geoStats.missing} sans coordonnées` : ""}
            </p>
          </div>
        </div>
        {isAdmin && geoStats.missing > 0 ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => backfill.mutate()}
            disabled={backfill.isPending}
          >
            {backfill.isPending ? "Géolocalisation…" : `Géolocaliser ${geoStats.missing} adresse(s)`}
          </Button>
        ) : null}
      </div>

      {logements.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {logements.error instanceof Error ? logements.error.message : "Erreur de chargement"}
        </Card>
      ) : null}

      <LogementsMap logements={items} />
    </div>
  );
}
