"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Wallet, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
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

type Granularity = "week" | "month" | "year" | "all";

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
  { key: "all", label: "Tout" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Bornes + libellé d'une période selon granularité et décalage (0 = courante). */
function computeRange(g: Granularity, offset: number): { from?: string; to?: string; label: string } {
  if (g === "all") return { label: "" };
  const now = new Date();
  if (g === "week") {
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return { from: ymd(monday), to: ymd(sunday), label: `${f(monday)} – ${f(sunday)} ${sunday.getFullYear()}` };
  }
  if (g === "month") {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return {
      from: ymd(first),
      to: ymd(last),
      label: first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }),
    };
  }
  const y = now.getFullYear() + offset;
  return { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) };
}

function money(value: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
}

export default function EarningsPage() {
  const { user } = useAuth();
  const [granularity, setGranularity] = usePersistedState<Granularity>(
    "earnings.filter.granularity",
    "month",
  );
  const [offset, setOffset] = useState(0);
  const range = useMemo(() => computeRange(granularity, offset), [granularity, offset]);
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
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {GRANULARITIES.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  setGranularity(p.key);
                  setOffset(0);
                }}
                className={
                  granularity === p.key
                    ? "rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                }
              >
                {p.label}
              </button>
            ))}
          </div>
          {granularity !== "all" ? (
            <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1 py-0.5 dark:border-zinc-800 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setOffset((o) => o - 1)}
                aria-label="Période précédente"
                className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="min-w-[9rem] text-center text-xs font-medium capitalize text-zinc-700 dark:text-zinc-300">
                {range.label}
              </span>
              <button
                type="button"
                onClick={() => setOffset((o) => o + 1)}
                aria-label="Période suivante"
                className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                <ChevronRight size={16} />
              </button>
              {offset !== 0 ? (
                <button
                  type="button"
                  onClick={() => setOffset(0)}
                  className="rounded-full px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
                >
                  Aujourd&apos;hui
                </button>
              ) : null}
            </div>
          ) : null}
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
