"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { usePersistedState } from "@/hooks/usePersistedState";
import { Archive, Search, Clock, Building2, ChevronLeft, ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { useMenages } from "@/hooks/useMenages";
import { useLogementsList } from "@/hooks/useLogementsList";
import { logementLabel, prestataireLabel } from "@/hooks/useCalendarMenages";
import type { User, PaginatedResponse } from "@/types/api";
import { formatDateFr } from "@/lib/date-fr";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<"valide" | "annule", string> = {
  valide: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  annule: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

type StatusFilter = "all" | "valide" | "annule";
type Granularity = "week" | "month" | "year" | "all";

const STATUSES: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "valide", label: "Validés" },
  { key: "annule", label: "Annulés" },
];

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "week", label: "Semaine" },
  { key: "month", label: "Mois" },
  { key: "year", label: "Année" },
  { key: "all", label: "Tout" },
];

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function computeRange(g: Granularity, offset: number): { min?: string; max?: string; label: string } {
  if (g === "all") return { label: "" };
  const now = new Date();
  if (g === "week") {
    const dow = (now.getDay() + 6) % 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dow + offset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const f = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return { min: ymd(monday), max: ymd(sunday), label: `${f(monday)} – ${f(sunday)} ${sunday.getFullYear()}` };
  }
  if (g === "month") {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    return { min: ymd(first), max: ymd(last), label: first.toLocaleDateString("fr-FR", { month: "long", year: "numeric" }) };
  }
  const y = now.getFullYear() + offset;
  return { min: `${y}-01-01`, max: `${y}-12-31`, label: String(y) };
}

export default function ArchivesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const logements = useLogementsList();
  const usersQuery = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => apiFetch<PaginatedResponse<User>>("/users?limit=200"),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>("archives.filter.status", "all");
  const [logementFilter, setLogementFilter] = usePersistedState("archives.filter.logement", "");
  const [prestaFilter, setPrestaFilter] = usePersistedState("archives.filter.presta", "");
  const [granularity, setGranularity] = usePersistedState<Granularity>("archives.filter.period", "all");
  const [offset, setOffset] = useState(0);
  const range = useMemo(() => computeRange(granularity, offset), [granularity, offset]);

  // Filtrage server-side : ménages clôturés (closed=true) + logement/prestataire/
  // période. Le statut (validé/annulé) et la recherche texte restent côté client.
  const list = useMenages({
    closed: true,
    logement_id: logementFilter || undefined,
    prestataire_user_id: prestaFilter || undefined,
    from: range.min,
    to: range.max,
    limit: 500,
  });

  const prestaOptions = (usersQuery.data?.data ?? []).filter((u) => u.role === "prestataire");

  const archived = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (list.data?.data ?? [])
      .filter((m) => (statusFilter === "all" ? true : m.status === statusFilter))
      .filter((m) => {
        if (!q) return true;
        return (
          (m.logement_name ?? "").toLowerCase().includes(q) ||
          (m.logement_city ?? "").toLowerCase().includes(q) ||
          (m.prestataire_first_name ?? "").toLowerCase().includes(q) ||
          (m.prestataire_last_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date_prevue.slice(0, 10).localeCompare(a.date_prevue.slice(0, 10)));
  }, [list.data, search, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Archive size={24} className="text-zinc-500" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Archives</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {list.isLoading
              ? "Chargement…"
              : `${archived.length} ménage${archived.length > 1 ? "s" : ""} clôturé${archived.length > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Filtres — même style que la liste Ménages */}
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative w-full lg:w-72 lg:flex-none">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-zinc-400" />
          <Input
            placeholder="Logement, ville, prestataire…"
            className="pl-9"
            wrapperClassName="w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inline-flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
          {GRANULARITIES.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setGranularity(p.key);
                setOffset(0);
              }}
              className={
                granularity === p.key
                  ? "rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "rounded-full px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        {granularity !== "all" ? (
          <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1 py-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="Période précédente" className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[9rem] text-center text-xs font-medium capitalize text-zinc-700 dark:text-zinc-300">{range.label}</span>
            <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="Période suivante" className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white">
              <ChevronRight size={16} />
            </button>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatusFilter(s.key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                statusFilter === s.key
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres avancés : logement + prestataire (admin) */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select aria-label="Filtrer par logement" value={logementFilter} onChange={(e) => setLogementFilter(e.target.value)} className="sm:max-w-xs">
          <option value="">Tous les logements</option>
          {(logements.data?.data ?? []).filter((l) => !l.archived_at).map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        {isAdmin ? (
          <Select aria-label="Filtrer par prestataire" value={prestaFilter} onChange={(e) => setPrestaFilter(e.target.value)} className="sm:max-w-xs">
            <option value="">Tous les prestataires</option>
            {prestaOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
              </option>
            ))}
          </Select>
        ) : null}
      </div>

      {list.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {list.error instanceof Error ? list.error.message : "Erreur de chargement"}
        </Card>
      ) : null}

      {list.isLoading ? (
        <Card>
          <p className="text-sm text-zinc-500">Chargement…</p>
        </Card>
      ) : archived.length === 0 ? (
        <EmptyState
          icon={<Archive size={32} />}
          title="Aucun ménage archivé"
          description="Les ménages validés ou annulés apparaissent ici."
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {archived.map((m) => {
              const unassigned = !m.prestataire_user_id;
              const pill = m.status === "valide" ? STATUS_PILL.valide : STATUS_PILL.annule;
              return (
                <li key={m.id}>
                  <Link
                    href={`/menages/${m.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-zinc-400" />
                        <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-white">
                          {formatDateFr(m.date_prevue.slice(0, 10), "long")}
                          {m.horaire_prevu ? (
                            <span className="ml-2 text-xs font-normal text-zinc-500">{m.horaire_prevu.slice(0, 5)}</span>
                          ) : null}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                        <Building2 size={11} className="inline-block mr-1 -mt-0.5 text-zinc-400" />
                        {logementLabel(m)}
                        {m.logement_city ? <span className="text-zinc-400"> · {m.logement_city}</span> : null}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      {unassigned ? (
                        <span className="text-xs text-zinc-400">Non assigné</span>
                      ) : (
                        <div className="hidden items-center gap-1.5 sm:inline-flex">
                          <Avatar
                            firstName={m.prestataire_first_name ?? undefined}
                            lastName={m.prestataire_last_name ?? undefined}
                            src={m.prestataire_avatar_url ?? undefined}
                            size="sm"
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">{prestataireLabel(m)}</span>
                        </div>
                      )}
                      <span className={cn("inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", pill)}>
                        {m.status === "valide" ? "Validé" : "Annulé"}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
