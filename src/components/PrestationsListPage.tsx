"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus, Search, Building2, User as UserIcon, Clock, List as ListIcon, Map as MapIcon, CheckSquare, X, Trash2, ClipboardCheck, CheckCircle2, Lock, AlertTriangle, Bell, CheckCheck, Ban, SlidersHorizontal, History, Check } from "lucide-react";
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
import { useDialog } from "@/contexts/DialogContext";
import { useMenages } from "@/hooks/useMenages";
import { useRescheduleRequests, useDecideReschedule } from "@/hooks/useRescheduleRequests";
import { logementLabel, prestataireLabel, type CalendarMenage } from "@/hooks/useCalendarMenages";
import { useLogementsList } from "@/hooks/useLogementsList";
import { useUnreadSummary } from "@/hooks/useMenageViews";
import { useQuery } from "@tanstack/react-query";
import type { User, PaginatedResponse } from "@/types/api";
import { formatDateFr } from "@/lib/date-fr";
import { cn } from "@/lib/utils";
import { prestationTypeLabel, prestationTypePill, PAST_WINDOW_DAYS, ymdLocal, type PrestationType } from "@/lib/prestation";
import type { RescheduleRequest } from "@/types/api";

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

// Une question par vue (parité mobile) : Planning = qu'est-ce qui se passe ?
// (par jour, à partir d'aujourd'hui) ; À traiter = qu'est-ce qui m'attend ?
// (à valider, non pointées, sans prestataire, demandes de report) ;
// l'Historique (un mois à la fois) est la page /archives.
type MainView = "planning" | "todo";

interface MenageSection {
  key: "today" | "upcoming";
  title: string;
  subtitle?: string;
  items: CalendarMenage[];
}

type TodoItem =
  | { kind: "menage"; id: string; m: CalendarMenage }
  | { kind: "reschedule"; id: string; r: RescheduleRequest; m: CalendarMenage | undefined };

interface TodoSection {
  key: "validate" | "late" | "unassigned" | "reschedule";
  title: string;
  color: string;
  items: TodoItem[];
}

/** Libellés dépendant du type de prestation (ménage / check-in / check-out). */
const COPY: Record<
  PrestationType,
  {
    title: string;
    noun: (n: number) => string;
    emptyTitle: string;
    emptyAll: string;
    emptyFilter: string;
    newLabel: string;
    storeKey: string;
    canCreate: boolean;
  }
> = {
  menage: {
    title: "Ménages",
    noun: (n) => `ménage${n > 1 ? "s" : ""}`,
    emptyTitle: "Aucun ménage",
    emptyAll: "Crée un ménage pour commencer.",
    emptyFilter: "Aucun ménage pour ce filtre.",
    newLabel: "Nouveau ménage",
    storeKey: "menages",
    canCreate: true,
  },
  check_in: {
    title: "Check-in",
    noun: (n) => `check-in${n > 1 ? "s" : ""}`,
    emptyTitle: "Aucun check-in",
    emptyAll: "Aucun check-in planifié pour l'instant.",
    emptyFilter: "Aucun check-in pour ce filtre.",
    newLabel: "Nouveau check-in",
    storeKey: "check_ins",
    canCreate: true,
  },
  check_out: {
    title: "Check-out",
    noun: (n) => `check-out${n > 1 ? "s" : ""}`,
    emptyTitle: "Aucun check-out",
    emptyAll: "Aucun check-out planifié pour l'instant.",
    emptyFilter: "Aucun check-out pour ce filtre.",
    newLabel: "Nouveau check-out",
    storeKey: "check_outs",
    canCreate: true,
  },
};

export default function PrestationsListPage({ prestationType }: { prestationType: PrestationType }) {
  const copy = COPY[prestationType];
  const { user } = useAuth();
  const { confirm } = useDialog();
  const isAdmin = user?.role === "admin";

  // Non-lus par ménage (mêmes données que le badge sidebar) → indicateur sur
  // chaque carte pour savoir où aller lire la nouveauté. Se vide quand on ouvre
  // le ménage (mark-tab-viewed invalide cette même query).
  const unreadSummary = useUnreadSummary(!!user);
  const unreadByMenage = unreadSummary.data?.by_menage ?? {};
  const unreadOfThisType = unreadSummary.data?.by_type?.[prestationType] ?? 0;

  // Filtres persistés en localStorage : reprend l'état au prochain chargement.
  // La clé est namespacée par type pour ne pas mélanger ménages / check-in / check-out.
  const [view, setView] = useState<MainView>("planning");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [logementFilter, setLogementFilter] = usePersistedState(`${copy.storeKey}.filter.logement`, "");
  const [prestaFilter, setPrestaFilter] = usePersistedState(`${copy.storeKey}.filter.presta`, "");
  const [creatorFilter, setCreatorFilter] = usePersistedState(`${copy.storeKey}.filter.creator`, "");
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(`${copy.storeKey}.filter.viewMode`, "list");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const qc = useQueryClient();
  const todayYmd = ymdLocal(new Date());

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
    const ok = await confirm({
      title: `Supprimer ${ids.length} ${copy.noun(ids.length)} ?`,
      description: "Action irréversible (photos, checklist, commentaires perdus).",
      tone: "danger",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
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
      toast.success(`${succeeded} ${copy.noun(succeeded)} supprimé${succeeded > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    }
    exitSelection();
  };

  const queryParams = useMemo(() => {
    // « Non assigné » vit dans le filtre prestataire → param unassigned côté API.
    const unassigned = prestaFilter === "__unassigned__" ? true : undefined;
    const base = { type: prestationType, ...(unassigned ? { unassigned: true } : {}) };
    // Une seule requête : toute la worklist active (non clôturée). Planning et
    // À traiter s'en déduisent côté client ; les clôturées vivent dans l'Historique.
    return { ...base, closed: false };
  }, [prestationType, prestaFilter]);

  const list = useMenages(queryParams);
  const pendingReschedules = useRescheduleRequests({ status: "pending" });
  const decide = useDecideReschedule();
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
    return (list.data?.data ?? [])
      .filter((m) => {
        if (logementFilter && m.logement_id !== logementFilter) return false;
        if (prestaFilter && prestaFilter !== "__unassigned__" && m.prestataire_user_id !== prestaFilter) return false;
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
        const today = todayYmd;
        const ad = a.date_prevue.slice(0, 10);
        const bd = b.date_prevue.slice(0, 10);
        const aUp = ad >= today;
        const bUp = bd >= today;
        if (aUp && bUp) return ad.localeCompare(bd);
        if (!aUp && !bUp) return bd.localeCompare(ad);
        return aUp ? -1 : 1;
      });
  }, [list.data, search, logementFilter, prestaFilter, creatorFilter, todayYmd]);

  // Planning : Aujourd'hui / À venir (le passé non traité est dans « À traiter »).
  const sections = useMemo<MenageSection[]>(() => {
    const today: CalendarMenage[] = [];
    const upcoming: CalendarMenage[] = [];
    for (const m of filtered) {
      const d = m.date_prevue.slice(0, 10);
      if (d === todayYmd) today.push(m);
      else if (d > todayYmd) upcoming.push(m);
    }
    const out: MenageSection[] = [];
    if (today.length) out.push({ key: "today", title: "Aujourd'hui", subtitle: formatDateFr(todayYmd, "weekday"), items: today });
    if (upcoming.length) out.push({ key: "upcoming", title: "À venir", items: upcoming });
    return out;
  }, [filtered, todayYmd]);
  const planningCount = sections.reduce((n, s) => n + s.items.length, 0);
  const summary = useMemo(() => {
    const today = filtered.filter((m) => m.date_prevue.slice(0, 10) === todayYmd);
    return {
      today: today.length,
      todayDone: today.filter((m) => m.status === "termine").length,
      enCours: today.filter((m) => m.status === "en_cours").length,
      unassigned: filtered.filter((m) => m.date_prevue.slice(0, 10) >= todayYmd && !m.prestataire_user_id).length,
      late: filtered.filter((m) => !!m.needs_attention).length,
    };
  }, [filtered, todayYmd]);

  // À traiter : tout ce qui attend l'admin, avec son action.
  const todo = useMemo<TodoSection[]>(() => {
    const byId = new Map((list.data?.data ?? []).map((m) => [m.id, m]));
    const shown = new Set(filtered.map((m) => m.id));
    const toValidate = filtered.filter((m) => m.status === "termine");
    const late = filtered.filter((m) => !!m.needs_attention);
    const unassigned = filtered.filter(
      (m) => m.status === "a_venir" && !m.needs_attention && m.date_prevue.slice(0, 10) >= todayYmd && !m.prestataire_user_id,
    );
    // Les demandes portent sur des prestations de ce type (celles de la worklist) ;
    // une demande sur une prestation inconnue ici appartient à un autre type.
    const reschedules = (pendingReschedules.data?.data ?? []).filter((r) => byId.has(r.menage_id) && shown.has(r.menage_id));
    const out: TodoSection[] = [];
    if (toValidate.length) out.push({ key: "validate", title: "À valider", color: "purple", items: toValidate.map((m) => ({ kind: "menage", id: m.id, m })) });
    if (late.length) out.push({ key: "late", title: late.length > 1 ? "Non pointées" : "Non pointée", color: "rose", items: late.map((m) => ({ kind: "menage", id: m.id, m })) });
    if (unassigned.length) out.push({ key: "unassigned", title: "Sans prestataire", color: "blue", items: unassigned.map((m) => ({ kind: "menage", id: m.id, m })) });
    if (reschedules.length)
      out.push({
        key: "reschedule",
        title: reschedules.length > 1 ? "Demandes de report" : "Demande de report",
        color: "amber",
        items: reschedules.map((r) => ({ kind: "reschedule", id: `r-${r.id}`, r, m: byId.get(r.menage_id) })),
      });
    return out;
  }, [filtered, list.data, pendingReschedules.data, todayYmd]);
  const todoCount = todo.reduce((n, s) => n + s.items.length, 0);

  const handleValidateAll = async () => {
    const ids = filtered.filter((m) => m.status === "termine").map((m) => m.id);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Valider ${ids.length} ${copy.noun(ids.length)} ?`,
      description: "Passage en « validée » au prix prévu, puis Historique.",
      confirmLabel: "Tout valider",
    });
    if (!ok) return;
    setBulkBusy(true);
    let succeeded = 0;
    for (const id of ids) {
      try {
        await apiFetch(`/menages/${id}/validate`, { method: "POST", body: {} });
        succeeded++;
      } catch (err) {
        toast.error(err instanceof ApiError ? `${id}: ${err.message}` : `Échec sur ${id}`);
      }
    }
    setBulkBusy(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} ${copy.noun(succeeded)} validé${succeeded > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    }
  };

  const handleDecide = async (r: RescheduleRequest, decision: "approved" | "rejected") => {
    try {
      await decide.mutateAsync({ id: r.id, decision, apply_to_menage: decision === "approved" });
      toast.success(decision === "approved" ? "Report accepté" : "Report refusé");
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Échec");
    }
  };

  // Sélection → objets (pour savoir ce qui est validable).
  const selectedMenages = useMemo(() => filtered.filter((m) => selectedIds.has(m.id)), [filtered, selectedIds]);
  const validableCount = selectedMenages.filter((m) => m.status === "termine").length;

  // Valider en lot : seules les terminées (rapport rendu) sont validables — la
  // validation engage la facturation, on ne valide jamais une prestation jamais
  // pointée. Pas de clôture automatique : c'est un geste de l'admin.
  const handleBulkValidate = async () => {
    const ids = selectedMenages.filter((m) => m.status === "termine").map((m) => m.id);
    const ignored = selectedMenages.length - ids.length;
    if (ids.length === 0) {
      toast.error("Seules les prestations terminées (rapport rendu) peuvent être validées.");
      return;
    }
    const ok = await confirm({
      title: `Valider ${ids.length} ${copy.noun(ids.length)} ?`,
      description:
        `Passage en « validée » au prix prévu, puis Historique.` +
        (ignored > 0 ? ` ${ignored} sélectionnée${ignored > 1 ? "s" : ""} non terminée${ignored > 1 ? "s" : ""} sera ignorée.` : ""),
      confirmLabel: "Valider",
    });
    if (!ok) return;
    setBulkBusy(true);
    let succeeded = 0;
    for (const id of ids) {
      try {
        await apiFetch(`/menages/${id}/validate`, { method: "POST", body: {} });
        succeeded++;
      } catch (err) {
        toast.error(err instanceof ApiError ? `${id}: ${err.message}` : `Échec sur ${id}`);
      }
    }
    setBulkBusy(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} ${copy.noun(succeeded)} validé${succeeded > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    }
    exitSelection();
  };

  // Annuler en lot : la prestation reste (Historique), les prestataires affectés
  // sont prévenus par l'API (« Ménage annulé »).
  const handleBulkCancel = async () => {
    const ids = selectedMenages.filter((m) => m.status !== "annule").map((m) => m.id);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Annuler ${ids.length} ${copy.noun(ids.length)} ?`,
      description:
        "Passage en « annulée » puis Historique (retrouvables, pas supprimées). Les prestataires affectés seront prévenus.",
      tone: "danger",
      confirmLabel: "Annuler les prestations",
    });
    if (!ok) return;
    setBulkBusy(true);
    let succeeded = 0;
    for (const id of ids) {
      try {
        await apiFetch(`/menages/${id}`, { method: "PATCH", body: { status: "annule" } });
        succeeded++;
      } catch (err) {
        toast.error(err instanceof ApiError ? `${id}: ${err.message}` : `Échec sur ${id}`);
      }
    }
    setBulkBusy(false);
    if (succeeded > 0) {
      toast.success(`${succeeded} ${copy.noun(succeeded)} annulé${succeeded > 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    }
    exitSelection();
  };

  const total = list.data?.meta.total ?? 0;

  // Garde-fou « badge fantôme » : le badge compte tous statuts, mais la liste est
  // filtrée (statut côté serveur + logement/presta/recherche côté client). On
  // scanne les prestations ACTIVES de ce type pour repérer celles qui ont du
  // nouveau mais que les filtres courants masquent → on les remonte en tête.
  const unreadScan = useMenages(
    { type: prestationType, closed: false },
    { enabled: unreadOfThisType > 0 },
  );
  const hiddenUnread = useMemo(() => {
    if (unreadOfThisType <= 0) return [];
    const shown = new Set(filtered.map((m) => m.id));
    return (unreadScan.data?.data ?? [])
      .filter((m) => (unreadByMenage[m.id] ?? 0) > 0 && !shown.has(m.id))
      .sort((a, b) => b.date_prevue.localeCompare(a.date_prevue));
  }, [unreadScan.data, filtered, unreadByMenage, unreadOfThisType]);

  const resetFilters = () => {
    setLogementFilter("");
    setPrestaFilter("");
    setCreatorFilter("");
    setSearch("");
  };

  // Filtres actifs (mémorisés, donc invisibles au 1er coup d'œil) → on les rend
  // explicites avec un bouton « Réinitialiser » pour éviter les « où sont mes
  // prestations ? » quand un filtre discret (créateur/presta/période) masque tout.
  const activeFilters = [
    logementFilter && "Logement",
    prestaFilter && "Prestataire",
    creatorFilter && "Créateur",
    search.trim() && "Recherche",
  ].filter(Boolean) as string[];
  const filterCount = [logementFilter, prestaFilter, creatorFilter].filter(Boolean).length;

  const logementOptions = (logements.data?.data ?? []).filter((l) => !l.archived_at);
  const prestaOptions = allUsers.filter((u) => u.role === "prestataire");

  // "Créateur" combine users qui ont créé une prestation manuellement + sources
  // externes (Airbnb, Booking, etc.). IDs préfixés : `user:<uuid>`, `src:<source>`,
  // `src:manual` pour les prestations créées manuellement.
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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{copy.title}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {list.isLoading ? "Chargement…" : `${total} ${copy.noun(total)}`}
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
              title="Sélectionner plusieurs éléments"
            >
              <CheckSquare size={16} />
              Sélectionner
            </Button>
          ) : null}
          {isAdmin && copy.canCreate && !selectionMode ? (
            <Link href={`/menages/new?type=${prestationType}`}>
              <Button>
                <Plus size={16} />
                {copy.newLabel}
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
            {selectedIds.size} {copy.noun(selectedIds.size)} sélectionné
            {selectedIds.size > 1 ? "s" : ""}
          </p>
          {/* Actions groupées : Valider (terminées seulement) · Annuler · Supprimer.
              Valider/Annuler vident la file des passées sans rien perdre (Historique). */}
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkValidate}
              disabled={selectedIds.size === 0 || bulkBusy || deleting}
              loading={bulkBusy}
              title="Seules les prestations terminées (rapport rendu) sont validées"
            >
              <CheckCheck size={14} />
              Valider{validableCount > 0 ? ` (${validableCount})` : ""}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkCancel}
              disabled={selectedIds.size === 0 || bulkBusy || deleting}
            >
              <Ban size={14} />
              Annuler
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || deleting || bulkBusy}
              loading={deleting}
            >
              <Trash2 size={14} />
              Supprimer
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <div className="relative w-full lg:w-72 lg:flex-none">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-zinc-400"
          />
          <Input
            placeholder="Logement, ville, prestataire…"
            className="pl-9"
            wrapperClassName="w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {(
            [
              { key: "planning" as const, label: "Planning", badge: 0 },
              { key: "todo" as const, label: "À traiter", badge: todoCount },
            ]
          ).map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => {
                setView(v.key);
                exitSelection();
              }}
              aria-pressed={view === v.key}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                view === v.key
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              )}
            >
              {v.label}
              {v.badge > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {v.badge > 99 ? "99+" : v.badge}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          title="Filtres : logement, prestataire, source"
        >
          <SlidersHorizontal size={16} />
          Filtres
          {filterCount > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {filterCount}
            </span>
          ) : null}
        </Button>
        <Link
          href="/archives"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <History size={14} />
          Historique
        </Link>
      </div>

      {/* Filtres (logement ; prestataire + source pour l'admin), repliés derrière
          le bouton « Filtres » : ils sortent du chemin de la liste (parité mobile). */}
      <div className={cn("flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center", !filtersOpen && "hidden")}>
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
              <option value="__unassigned__">Non assigné</option>
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
        <button
          type="button"
          onClick={resetFilters}
          disabled={activeFilters.length === 0}
          className="text-xs font-semibold text-blue-600 hover:underline disabled:text-zinc-400 disabled:no-underline dark:text-blue-400 sm:ml-auto"
        >
          Réinitialiser
        </button>
      </div>

      {list.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {list.error instanceof Error ? list.error.message : "Erreur de chargement"}
        </Card>
      ) : null}

      {hiddenUnread.length > 0 ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <Bell size={14} />
              {hiddenUnread.length === 1
                ? "1 prestation avec du nouveau est masquée par tes filtres"
                : `${hiddenUnread.length} prestations avec du nouveau sont masquées par tes filtres`}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-rose-600 underline hover:text-rose-700 dark:text-rose-300"
            >
              Réinitialiser les filtres
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {hiddenUnread.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/menages/${m.id}`}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-700 hover:bg-rose-100 dark:text-zinc-200 dark:hover:bg-rose-900/40"
                >
                  <span className="truncate">
                    <span className="capitalize">
                      {formatDateFr(m.date_prevue.slice(0, 10), "weekday")}
                    </span>
                    <span className="text-zinc-400"> · </span>
                    {logementLabel(m)}
                  </span>
                  <span className="inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold leading-none text-white">
                    {(unreadByMenage[m.id] ?? 0) > 99 ? "99+" : unreadByMenage[m.id]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {list.isLoading ? (
        <Card>
          <p className="text-sm text-zinc-500">Chargement…</p>
        </Card>
      ) : viewMode === "map" ? (
        <MenagesMap menages={filtered} />
      ) : view === "todo" ? (
        todo.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={32} />}
            title="Tout est à jour"
            description="Rien à valider, rien en retard, personne à affecter, aucune demande en attente."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {todo.map((section) => (
              <section key={section.key} className="flex flex-col gap-3">
                <header className="sticky top-0 z-10 flex items-center gap-2 bg-zinc-50/95 py-1.5 backdrop-blur dark:bg-zinc-950/90">
                  <h2 className={cn("text-xs font-bold uppercase tracking-wider", TODO_TITLE[section.color])}>{section.title}</h2>
                  <span className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold", TODO_COUNT[section.color])}>
                    {section.items.length}
                  </span>
                  {section.key === "validate" && isAdmin && !selectionMode ? (
                    <Button size="sm" className="ml-auto" onClick={handleValidateAll} disabled={bulkBusy} loading={bulkBusy}>
                      <CheckCheck size={14} />
                      Tout valider
                    </Button>
                  ) : null}
                </header>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  {section.items.map((item) =>
                    item.kind === "reschedule" ? (
                      <RescheduleCard
                        key={item.id}
                        r={item.r}
                        m={item.m}
                        requester={userName(item.r.requested_by)}
                        busy={decide.isPending}
                        onDecide={handleDecide}
                      />
                    ) : (
                      renderMenageCard(
                        item.m,
                        section.key === "validate",
                        section.key === "validate"
                          ? item.m.departed_at
                            ? `Terminé le ${formatDateFr(item.m.departed_at, "datetime")}`
                            : "Rapport rendu"
                          : section.key === "late"
                            ? "Jour passé sans pointage · ouvre la fiche pour corriger les heures ou annuler"
                            : undefined,
                      )
                    ),
                  )}
                </div>
              </section>
            ))}
            <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              Les prestations passées non traitées depuis plus de {PAST_WINDOW_DAYS} jours sont dans{" "}
              <Link href="/archives" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                l’Historique
              </Link>
              .
            </p>
          </div>
        )
      ) : planningCount === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title={copy.emptyTitle}
          description={search || filterCount ? "Aucune prestation pour ces filtres." : copy.emptyAll}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
            {[
              { n: summary.today, label: "aujourd'hui", cls: "text-zinc-900 dark:text-white" },
              { n: summary.enCours, label: "en cours", cls: "text-amber-600 dark:text-amber-400" },
              { n: summary.unassigned, label: summary.unassigned > 1 ? "non assignées" : "non assignée", cls: "text-blue-600 dark:text-blue-400" },
              { n: summary.late, label: summary.late > 1 ? "non pointées" : "non pointée", cls: "text-rose-600 dark:text-rose-400" },
            ].map((c) => (
              <div key={c.label} className="flex flex-col">
                <span className={cn("text-xl font-bold tabular-nums", c.n > 0 ? c.cls : "text-zinc-400")}>{c.n}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{c.label}</span>
              </div>
            ))}
          </div>
          {sections.map((section) => (
          <section key={section.key} className="flex flex-col gap-3">
            <header
              className={cn(
                "sticky top-0 z-10 flex items-baseline gap-2 bg-zinc-50/95 py-1.5 backdrop-blur dark:bg-zinc-950/90",
              )}
            >
              <h2
                className={cn(
                  "text-xs font-bold uppercase tracking-wider",
                  section.key === "today" ? "text-blue-600 dark:text-blue-400" : "text-zinc-500 dark:text-zinc-400",
                )}
              >
                {section.title}
              </h2>
              {section.subtitle ? (
                <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">{section.subtitle}</span>
              ) : null}
              <span
                className={cn(
                  "ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                  section.key === "today"
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {section.items.length}
              </span>
            </header>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {section.items.map((m) => renderMenageCard(m))}
          </div>
          </section>
          ))}
        </div>
      )}
    </div>
  );

  // Carte d'une prestation (Planning et À traiter). Fonction de rendu (pas un
  // composant) : définie dans la fermeture pour accéder à la sélection et aux
  // non-lus sans changer d'identité à chaque rendu.
  function renderMenageCard(m: CalendarMenage, muted = false, note?: string) {
    {
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
                        : muted
                          ? "bg-zinc-100 shadow-none dark:bg-zinc-900/60"
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
                      {note ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{note}</p> : null}
                      <div className="mt-2 flex min-h-8 items-center gap-2">
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
                    <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {unreadByMenage[m.id] ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white"
                            title="Nouvelle activité non lue — ouvre la fiche pour la consulter"
                          >
                            <Bell size={10} />
                            {unreadByMenage[m.id] > 99 ? "99+" : unreadByMenage[m.id]}
                          </span>
                        ) : null}
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
                        {/* « Non pointé » tient lieu de statut : un « À venir » dont
                            le jour est passé sans pointage n'a plus de sens à côté. */}
                        {m.needs_attention ? null : (
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
                        )}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          prestationTypePill(m.prestation_type),
                        )}
                      >
                        {prestationTypeLabel(m.prestation_type)}
                      </span>
                    </div>
                  </div>
                </Card>
              </CardWrapper>
            );
    }
  }
}

const TODO_TITLE: Record<string, string> = {
  purple: "text-purple-600 dark:text-purple-400",
  rose: "text-rose-600 dark:text-rose-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
};
const TODO_COUNT: Record<string, string> = {
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

/** Demande de report en attente : qui propose quoi, et Accepter / Refuser inline. */
function RescheduleCard({
  r,
  m,
  requester,
  busy,
  onDecide,
}: {
  r: RescheduleRequest;
  m: CalendarMenage | undefined;
  requester: string;
  busy: boolean;
  onDecide: (r: RescheduleRequest, decision: "approved" | "rejected") => void;
}) {
  const proposed = `${formatDateFr(r.proposed_date.slice(0, 10), "weekday")}${r.proposed_time ? ` à ${r.proposed_time.slice(0, 5)}` : ""}`;
  return (
    <Card className="bg-zinc-100 shadow-none dark:bg-zinc-900/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link href={`/menages/${r.menage_id}`} className="text-base font-semibold capitalize text-zinc-900 hover:underline dark:text-white">
            {formatDateFr(r.original_date.slice(0, 10), "weekday")}
          </Link>
          {m ? (
            <p className="mt-1 truncate text-sm text-zinc-700 dark:text-zinc-300">
              <Building2 size={12} className="inline-block mr-1 -mt-0.5 text-zinc-400" />
              {logementLabel(m)}
              {m.logement_city ? <span className="text-zinc-400"> · {m.logement_city}</span> : null}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-white">{requester}</span> propose{" "}
            <span className="font-medium text-amber-700 dark:text-amber-300">{proposed}</span>
            {r.reason ? <span className="text-zinc-500"> · « {r.reason} »</span> : null}
          </p>
        </div>
        {m ? (
          <span className={cn("inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", prestationTypePill(m.prestation_type))}>
            {prestationTypeLabel(m.prestation_type)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Button variant="secondary" size="sm" onClick={() => onDecide(r, "rejected")} disabled={busy}>
          <X size={14} />
          Refuser
        </Button>
        <Button size="sm" onClick={() => onDecide(r, "approved")} disabled={busy}>
          <Check size={14} />
          Accepter
        </Button>
      </div>
    </Card>
  );
}
