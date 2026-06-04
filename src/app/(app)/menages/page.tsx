"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus, Search, Building2, User as UserIcon, Clock, List as ListIcon, Map as MapIcon, CheckSquare, X, Trash2, ClipboardCheck, CheckCircle2, Lock, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useMenages, type MenageFilter } from "@/hooks/useMenages";
import { logementLabel, prestataireLabel, type CalendarMenage } from "@/hooks/useCalendarMenages";
import { useLogementsList } from "@/hooks/useLogementsList";
import { useQuery } from "@tanstack/react-query";
import type { User, PaginatedResponse } from "@/types/api";
import { formatDateFr } from "@/lib/date-fr";
import { cn } from "@/lib/utils";

// Leaflet manipule window → désactive le SSR.
const MenagesMap = dynamic(() => import("@/components/MenagesMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100vh-14rem)] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
      Chargement de la carte…
    </div>
  ),
});

type ViewMode = "list" | "map";

const STATUS_PILL: Record<CalendarMenage["status"], string> = {
  a_venir: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  en_cours: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  termine: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  valide: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  annule: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_LABEL: Record<CalendarMenage["status"], string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "À valider",
  valide: "Validé",
  annule: "Annulé",
};

const FILTERS: { value: MenageFilter; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "a_venir", label: "À venir" },
  { value: "en_cours", label: "En cours" },
  { value: "termine", label: "Terminé" },
  { value: "valide", label: "Validé" },
  { value: "to_validate", label: "À valider" },
  { value: "unassigned", label: "Non assignés" },
  { value: "annule", label: "Annulés" },
];

export default function MenagesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // Filtres persistés en localStorage : reprend l'état au prochain chargement.
  const [filter, setFilter] = usePersistedState<MenageFilter>("menages.filter.status", "all");
  const [search, setSearch] = useState("");
  const [logementFilter, setLogementFilter] = usePersistedState("menages.filter.logement", "");
  const [prestaFilter, setPrestaFilter] = usePersistedState("menages.filter.presta", "");
  const [creatorFilter, setCreatorFilter] = usePersistedState("menages.filter.creator", "");
  const [periodFilter, setPeriodFilter] = usePersistedState<"week" | "month" | "all">(
    "menages.filter.period",
    "all",
  );
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("menages.filter.viewMode", "list");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const qc = useQueryClient();

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      !confirm(
        `Supprimer ${ids.length} ménage${ids.length > 1 ? "s" : ""} ? Action irréversible (photos, checklist, commentaires perdus).`,
      )
    )
      return;
    setDeleting(true);
    let succeeded = 0;
    for (const id of ids) {
      try {
        await apiFetch(`/menages/${id}`, { method: "DELETE" });
        succeeded++;
      } catch (err) {
        toast.error(
          err instanceof ApiError ? `${id}: ${err.message}` : `Échec sur ${id}`,
        );
      }
    }
    setDeleting(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} ménage${succeeded > 1 ? "s" : ""} supprimé${succeeded > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    }
    exitSelection();
  };

  const queryParams = useMemo(() => {
    if (filter === "all") return {};
    if (filter === "to_validate") return { status: "termine" as const, validated: false };
    if (filter === "unassigned") return { unassigned: true };
    return { status: filter };
  }, [filter]);

  const list = useMenages(queryParams);
  const logements = useLogementsList();
  const usersQuery = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => apiFetch<PaginatedResponse<User>>("/users?limit=200"),
    enabled: isAdmin,
    staleTime: 60_000,
  });
  const allUsers = usersQuery.data?.data ?? [];
  const userName = (id: string) => {
    const u = allUsers.find((x) => x.id === id);
    return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email : "—";
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const todayDate = new Date();
    let periodMin: string | null = null;
    let periodMax: string | null = null;
    if (periodFilter === "week") {
      const d = new Date(todayDate);
      const dow = (d.getDay() + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      periodMin = monday.toISOString().slice(0, 10);
      periodMax = sunday.toISOString().slice(0, 10);
    } else if (periodFilter === "month") {
      const y = todayDate.getFullYear();
      const m = todayDate.getMonth();
      periodMin = new Date(y, m, 1).toISOString().slice(0, 10);
      periodMax = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    }
    return (list.data?.data ?? [])
      .filter((m) => {
        if (logementFilter && m.logement_id !== logementFilter) return false;
        if (prestaFilter && m.prestataire_user_id !== prestaFilter) return false;
        if (creatorFilter) {
          if (creatorFilter.startsWith("src:")) {
            const src = creatorFilter.slice(4);
            const matches = src === "manual" ? !m.external_source : m.external_source === src;
            if (!matches) return false;
          } else if (creatorFilter.startsWith("user:")) {
            if (m.created_by !== creatorFilter.slice(5)) return false;
          } else if (m.created_by !== creatorFilter) {
            return false;
          }
        }
        if (periodMin && m.date_prevue.slice(0, 10) < periodMin) return false;
        if (periodMax && m.date_prevue.slice(0, 10) > periodMax) return false;
        if (!q) return true;
        return (
          (m.logement_name ?? "").toLowerCase().includes(q) ||
          (m.logement_city ?? "").toLowerCase().includes(q) ||
          (m.logement_address ?? "").toLowerCase().includes(q) ||
          (m.prestataire_first_name ?? "").toLowerCase().includes(q) ||
          (m.prestataire_last_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Agenda : à venir d'abord (plus proche → lointain), puis passé (récent → ancien).
        const today = new Date().toISOString().slice(0, 10);
        const ad = a.date_prevue.slice(0, 10);
        const bd = b.date_prevue.slice(0, 10);
        const aUp = ad >= today;
        const bUp = bd >= today;
        if (aUp && bUp) return ad.localeCompare(bd);
        if (!aUp && !bUp) return bd.localeCompare(ad);
        return aUp ? -1 : 1;
      });
  }, [list.data, search, logementFilter, prestaFilter, creatorFilter, periodFilter]);

  const total = list.data?.meta.total ?? 0;

  const logementOptions = (logements.data?.data ?? []).filter((l) => !l.archived_at);
  const prestaOptions = allUsers.filter((u) => u.role === "prestataire");

  // "Créateur" combine users qui ont créé un ménage manuellement + sources
  // externes (Airbnb, Booking, etc.). IDs préfixés : `user:<uuid>`, `src:<source>`,
  // `src:manual` pour les ménages créés manuellement.
  const creatorOptions = useMemo(() => {
    const menages = list.data?.data ?? [];
    const userIds = new Set<string>();
    const sources = new Set<string>();
    let hasManual = false;
    for (const m of menages) {
      if (m.external_source) sources.add(m.external_source);
      else hasManual = true;
      if (m.created_by) userIds.add(m.created_by);
    }
    const result: { id: string; label: string }[] = [];
    if (hasManual) result.push({ id: "src:manual", label: "Manuel" });
    for (const s of Array.from(sources).sort()) {
      const provider = s.replace(/^cal_/, "");
      const labelMap: Record<string, string> = {
        airbnb: "Airbnb",
        booking: "Booking",
        vrbo: "Vrbo",
        ical: "iCal",
      };
      result.push({ id: `src:${s}`, label: labelMap[provider] ?? "Externe" });
    }
    for (const id of userIds) result.push({ id: `user:${id}`, label: userName(id) });
    return result;
  }, [list.data, allUsers]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Ménages</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {list.isLoading
              ? "Chargement…"
              : `${total} ménage${total > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              aria-label="Vue liste"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                viewMode === "list"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              <ListIcon size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("map")}
              aria-pressed={viewMode === "map"}
              aria-label="Vue carte"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                viewMode === "map"
                  ? "bg-blue-600 text-white"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100",
              )}
            >
              <MapIcon size={16} />
            </button>
          </div>
          {isAdmin && !selectionMode ? (
            <Button
              variant="secondary"
              onClick={() => setSelectionMode(true)}
              title="Sélectionner plusieurs ménages"
            >
              <CheckSquare size={16} />
              Sélectionner
            </Button>
          ) : null}
          {isAdmin && !selectionMode ? (
            <Link href="/menages/new">
              <Button>
                <Plus size={16} />
                Nouveau ménage
              </Button>
            </Link>
          ) : null}
          {selectionMode ? (
            <Button variant="ghost" onClick={exitSelection}>
              <X size={16} />
              Annuler
            </Button>
          ) : null}
        </div>
      </div>

      {selectionMode ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-900/20">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            {selectedIds.size} ménage{selectedIds.size > 1 ? "s" : ""} sélectionné
            {selectedIds.size > 1 ? "s" : ""}
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || deleting}
            loading={deleting}
          >
            <Trash2 size={14} />
            Supprimer
          </Button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
          />
          <Input
            placeholder="Logement, ville, prestataire…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="inline-flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
          {(
            [
              { key: "week" as const, label: "Semaine" },
              { key: "month" as const, label: "Mois" },
              { key: "all" as const, label: "Tout" },
            ]
          ).map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriodFilter(p.key)}
              className={
                periodFilter === p.key
                  ? "rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-white"
                  : "rounded-full px-3 py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
              }
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.value
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filtres avancés : logement (tous), prestataire + créateur (admin) */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select
          aria-label="Filtrer par logement"
          value={logementFilter}
          onChange={(e) => setLogementFilter(e.target.value)}
          className="sm:max-w-xs"
        >
          <option value="">Tous les logements</option>
          {logementOptions.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        {isAdmin ? (
          <>
            <Select
              aria-label="Filtrer par prestataire"
              value={prestaFilter}
              onChange={(e) => setPrestaFilter(e.target.value)}
              className="sm:max-w-xs"
            >
              <option value="">Tous les prestataires</option>
              {prestaOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrer par créateur"
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              className="sm:max-w-xs"
            >
              <option value="">Tous les créateurs</option>
              {creatorOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
          </>
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
      ) : viewMode === "map" ? (
        <MenagesMap menages={filtered} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="Aucun ménage"
          description={
            search
              ? "Aucun résultat pour cette recherche."
              : filter === "all"
                ? "Crée un ménage pour commencer."
                : "Aucun ménage pour ce filtre."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {filtered.map((m) => {
            const unassigned = !m.prestataire_user_id;
            const isSelected = selectedIds.has(m.id);
            const CardWrapper: React.ElementType = selectionMode ? "button" : Link;
            const wrapperProps = selectionMode
              ? {
                  type: "button" as const,
                  onClick: () => toggleSelection(m.id),
                  className: "block w-full text-left",
                }
              : { href: `/menages/${m.id}` };
            return (
              <CardWrapper key={m.id} {...wrapperProps}>
                <Card
                  className={cn(
                    "transition-colors hover:border-blue-500/50",
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-500/40 dark:border-blue-400"
                      : m.needs_attention
                        ? "border-rose-300 bg-rose-50 dark:border-rose-800/70 dark:bg-rose-950/30"
                        : "",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold capitalize text-zinc-900 dark:text-white">
                        {formatDateFr(m.date_prevue.slice(0, 10), "weekday")}
                        {m.date_locked ? (
                          <Lock
                            size={12}
                            className="ml-1.5 -mt-0.5 inline-block text-amber-600 dark:text-amber-400"
                          />
                        ) : null}
                        {m.horaire_prevu ? (
                          <span className="ml-2 inline-flex items-center gap-1 text-sm font-normal text-zinc-500">
                            <Clock size={12} />
                            {m.horaire_prevu.slice(0, 5)}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
                        <Building2 size={12} className="inline-block mr-1 -mt-0.5 text-zinc-400" />
                        {logementLabel(m)}
                        {m.logement_city ? (
                          <span className="text-zinc-400"> · {m.logement_city}</span>
                        ) : null}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {unassigned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            <UserIcon size={10} />
                            Non assigné
                          </span>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <Avatar
                              firstName={m.prestataire_first_name ?? undefined}
                              lastName={m.prestataire_last_name ?? undefined}
                              src={m.prestataire_avatar_url ?? undefined}
                              size="sm"
                            />
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">
                              {prestataireLabel(m)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-1">
                      {m.needs_attention ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                          <AlertTriangle size={10} />
                          Non pointé
                        </span>
                      ) : null}
                      {m.has_pending_reschedule ? (
                        <span
                          className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                          title="Demande de changement en attente"
                        >
                          <Clock size={11} />
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          STATUS_PILL[m.status],
                        )}
                      >
                        {m.status === "termine" ? (
                          <ClipboardCheck size={11} />
                        ) : m.status === "valide" ? (
                          <CheckCircle2 size={11} />
                        ) : null}
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                  </div>
                </Card>
              </CardWrapper>
            );
          })}
        </div>
      )}
    </div>
  );
}
