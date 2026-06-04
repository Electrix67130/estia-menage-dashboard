"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Wallet, RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface Bucket {
  id: string;
  name: string;
  total: number;
  count: number;
}

interface AdminEarnings {
  total: number;
  currency: string;
  count: number;
  from: string | null;
  to: string | null;
  by_client: Bucket[];
  by_prestataire: Bucket[];
}

type Preset = "this-month" | "last-month" | "this-year" | "all";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "this-month", label: "Ce mois" },
  { key: "last-month", label: "Mois dernier" },
  { key: "this-year", label: "Cette année" },
  { key: "all", label: "Tout" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(p: Preset): { from?: string; to?: string } {
  const now = new Date();
  if (p === "this-month") {
    return {
      from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (p === "last-month") {
    return {
      from: ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      to: ymd(new Date(now.getFullYear(), now.getMonth(), 0)),
    };
  }
  if (p === "this-year") {
    return {
      from: ymd(new Date(now.getFullYear(), 0, 1)),
      to: ymd(new Date(now.getFullYear(), 11, 31)),
    };
  }
  return {};
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
}

export default function EarningsPage() {
  const { user } = useAuth();
  const [preset, setPreset] = usePersistedState<Preset>("earnings.filter.period", "this-month");
  const range = useMemo(() => presetRange(preset), [preset]);
  const isAdmin = user?.role === "admin";

  const query = useQuery({
    queryKey: ["admin-earnings", range.from ?? "", range.to ?? ""],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (range.from) qs.set("from", range.from);
      if (range.to) qs.set("to", range.to);
      return apiFetch<AdminEarnings>(`/admin/earnings${qs.toString() ? `?${qs}` : ""}`);
    },
    enabled: isAdmin,
  });

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Accès réservé aux administrateurs.</p>
        </Card>
      </div>
    );
  }

  const data = query.data;
  const currency = data?.currency ?? "EUR";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wallet size={24} className="text-zinc-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Gains</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {data ? `${data.count} ménage${data.count > 1 ? "s" : ""} sur la période` : "Chargement…"}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
          aria-label="Rafraîchir"
        >
          <RefreshCw size={14} className={query.isFetching ? "animate-spin" : undefined} />
        </Button>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={
                preset === p.key
                  ? "rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              }
            >
              {p.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="rounded-xl border border-zinc-200 bg-gradient-to-br from-blue-50 to-white p-6 dark:border-zinc-800 dark:from-blue-950/30 dark:to-zinc-950">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total équipe (coût prestataire)</p>
        <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-white">
          {money(data?.total ?? 0, currency)}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Par client</h2>
          {query.isLoading ? (
            <p className="text-sm text-zinc-500">Chargement…</p>
          ) : (data?.by_client.length ?? 0) === 0 ? (
            <p className="text-sm text-zinc-500">Aucune donnée sur la période.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data!.by_client.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-white">{b.name}</p>
                    <p className="text-xs text-zinc-500">
                      {b.count} ménage{b.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
                    {money(b.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Par prestataire</h2>
          <p className="mb-3 text-[11px] text-zinc-500">
            En cas de ménage multi-prestataires, le coût est réparti à parts égales.
          </p>
          {query.isLoading ? (
            <p className="text-sm text-zinc-500">Chargement…</p>
          ) : (data?.by_prestataire.length ?? 0) === 0 ? (
            <p className="text-sm text-zinc-500">Aucune donnée sur la période.</p>
          ) : (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data!.by_prestataire.map((b) => (
                <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-zinc-900 dark:text-white">{b.name}</p>
                    <p className="text-xs text-zinc-500">
                      {b.count.toFixed(1)} ménage{b.count > 1 ? "s" : ""}
                    </p>
                  </div>
                  <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
                    {money(b.total, currency)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
