"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus, Search, Building2, Clock, List as ListIcon, Map as MapIcon, CheckSquare, X, Trash2, ClipboardCheck, CheckCircle2, Lock, AlertTriangle, Bell, CheckCheck, Ban, SlidersHorizontal, History, Check, UserPlus, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiError } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import DispoBadge, { dispoState } from "@/components/DispoBadge";
import { PrestatairePickerModal } from "@/components/PrestatairePicker";
import { useAuth } from "@/contexts/AuthContext";
import { useDialog } from "@/contexts/DialogContext";
import { useI18n } from "@/contexts/I18nContext";
import { pluralKey, type Locale, type TFn } from "@/i18n/translations";
import { useMenages, type AvailabilityFilter } from "@/hooks/useMenages";
import { useRelanceMenage } from "@/hooks/useMenageResponses";
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
  loading: () => <MapLoading />,
});

function MapLoading() {
  const { t } = useI18n();
  return (
    <div className="flex h-[calc(100vh-14rem)] items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40">
      {t("prestations.mapLoading")}
    </div>
  );
}

type ViewMode = "list" | "map";

const STATUS_PILL: Record<CalendarMenage["status"], string> = {
  a_venir: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  en_cours: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  termine: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  valide: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  annule: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_KEY: Record<CalendarMenage["status"], string> = {
  a_venir: "menages.statusUpcoming",
  en_cours: "menages.statusInProgress",
  termine: "prestation.statusToValidate",
  valide: "menages.statusValidated",
  annule: "menages.statusCancelled",
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
  key: "validate" | "late" | "unassigned_available" | "unassigned_none" | "reschedule";
  title: string;
  subtitle?: string;
  color: string;
  items: TodoItem[];
}

/** Clés i18n dépendant du type de prestation (ménage / check-in / check-out). */
const COPY_KEYS: Record<
  PrestationType,
  { title: string; noun: string; emptyTitle: string; emptyAll: string; newLabel: string; storeKey: string; canCreate: boolean }
> = {
  menage: {
    title: "menages.title",
    noun: "prestations.noun.menage",
    emptyTitle: "prestations.empty.menage",
    emptyAll: "prestations.emptyAll.menage",
    newLabel: "prestations.new.menage",
    storeKey: "menages",
    canCreate: true,
  },
  check_in: {
    title: "nav.checkIns",
    noun: "prestations.noun.checkIn",
    emptyTitle: "prestations.empty.checkIn",
    emptyAll: "prestations.emptyAll.checkIn",
    newLabel: "prestations.new.checkIn",
    storeKey: "check_ins",
    canCreate: true,
  },
  check_out: {
    title: "nav.checkOuts",
    noun: "prestations.noun.checkOut",
    emptyTitle: "prestations.empty.checkOut",
    emptyAll: "prestations.emptyAll.checkOut",
    newLabel: "prestations.new.checkOut",
    storeKey: "check_outs",
    canCreate: true,
  },
};

/** Libellés résolus dans la langue courante. */
function buildCopy(type: PrestationType, t: TFn, locale: Locale) {
  const k = COPY_KEYS[type];
  return {
    title: t(k.title),
    /** Nom commun accordé en nombre (« ménage » / « ménages »). */
    noun: (n: number) => t(pluralKey(k.noun, n, locale)),
    emptyTitle: t(k.emptyTitle),
    emptyAll: t(k.emptyAll),
    newLabel: t(k.newLabel),
    storeKey: k.storeKey,
    canCreate: k.canCreate,
  };
}

export default function PrestationsListPage({ prestationType }: { prestationType: PrestationType }) {
  const { t, tp, locale } = useI18n();
  const copy = buildCopy(prestationType, t, locale);
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
  const [availabilityFilter, setAvailabilityFilter] = usePersistedState<AvailabilityFilter | "">(
    `${copy.storeKey}.filter.availability`,
    "",
  );
  const [viewMode, setViewMode] = usePersistedState<ViewMode>(`${copy.storeKey}.filter.viewMode`, "list");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  // « Qui est dispo ? » : modale d'affectation ouverte depuis une carte, et
  // relance en cours (un seul bouton « Relancer » à la fois en spinner).
  const [assignTarget, setAssignTarget] = useState<CalendarMenage | null>(null);
  const [relancingId, setRelancingId] = useState<string | null>(null);
  const relance = useRelanceMenage();
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
      title: t("prestations.deleteTitle", { count: ids.length, noun: copy.noun(ids.length) }),
      description: t("prestations.deleteDesc"),
      tone: "danger",
      confirmLabel: t("common.delete"),
    });
    if (!ok) return;
    setDeleting(true);
    let succeeded = 0;
    for (const id of ids) {
      try {
        await apiFetch(`/menages/${id}`, { method: "DELETE" });
        succeeded++;
      } catch (err) {
        toast.error(err instanceof ApiError ? `${id}: ${err.message}` : t("prestations.failedOn", { id }));
      }
    }
    setDeleting(false);
    if (succeeded > 0) {
      toast.success(tp("prestations.deleted", succeeded, { noun: copy.noun(succeeded) }));
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    }
    exitSelection();
  };

  const queryParams = useMemo(() => {
    // « Non assigné » vit dans le filtre prestataire → param unassigned côté API.
    // Le filtre Disponibilité ne concerne que les prestations SANS prestataire :
    // les votes ne servent qu'avant l'affectation. Une prestation déjà affectée
    // sur laquelle quelqu'un avait dit Présent n'a plus rien à traiter, et une
    // affectée sans vote est normale (assignée directement par l'admin). Le
    // filtre API, lui, reste brut et combinable — c'est l'app qui sait ce que
    // l'utilisateur cherche (même règle que le mobile).
    const unassigned = prestaFilter === "__unassigned__" || !!availabilityFilter ? true : undefined;
    const base = {
      type: prestationType,
      ...(unassigned ? { unassigned: true } : {}),
      ...(availabilityFilter ? { availability: availabilityFilter } : {}),
    };
    // Une seule requête : toute la worklist active (non clôturée). Planning et
    // À traiter s'en déduisent côté client ; les clôturées vivent dans l'Historique.
    return { ...base, closed: false };
  }, [prestationType, prestaFilter, availabilityFilter]);

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
    if (today.length) out.push({ key: "today", title: t("prestations.sectionToday"), subtitle: formatDateFr(todayYmd, "weekday"), items: today });
    if (upcoming.length) out.push({ key: "upcoming", title: t("prestations.sectionUpcoming"), items: upcoming });
    return out;
  }, [filtered, todayYmd, t]);
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
    if (toValidate.length) out.push({ key: "validate", title: t("prestations.sectionValidate"), color: "purple", items: toValidate.map((m) => ({ kind: "menage", id: m.id, m })) });
    if (late.length) out.push({ key: "late", title: t(pluralKey("prestations.sectionLate", late.length, locale)), color: "rose", items: late.map((m) => ({ kind: "menage", id: m.id, m })) });
    // « Qui est dispo ? » : d'abord celles qu'un clic suffit à affecter (au
    // moins un « Présent »), puis celles où il faut relancer / chercher ailleurs.
    const unassignedAvailable = unassigned.filter((m) => dispoState(m) === "available");
    const unassignedNone = unassigned.filter((m) => dispoState(m) !== "available");
    if (unassignedAvailable.length)
      out.push({
        key: "unassigned_available",
        title: t("prestations.sectionUnassignedAvailable"),
        subtitle: tp("prestations.sectionUnassignedAvailableSub", unassignedAvailable.length),
        color: "teal",
        items: unassignedAvailable.map((m) => ({ kind: "menage", id: m.id, m })),
      });
    if (unassignedNone.length)
      out.push({
        key: "unassigned_none",
        title: t("prestations.sectionUnassignedNone"),
        subtitle: tp("prestations.sectionUnassignedNoneSub", unassignedNone.length),
        color: "rose",
        items: unassignedNone.map((m) => ({ kind: "menage", id: m.id, m })),
      });
    if (reschedules.length)
      out.push({
        key: "reschedule",
        title: t(pluralKey("prestations.sectionReschedule", reschedules.length, locale)),
        color: "amber",
        items: reschedules.map((r) => ({ kind: "reschedule", id: `r-${r.id}`, r, m: byId.get(r.menage_id) })),
      });
    return out;
  }, [filtered, list.data, pendingReschedules.data, todayYmd, t, tp, locale]);
  const todoCount = todo.reduce((n, s) => n + s.items.length, 0);

  const handleValidateAll = async () => {
    const ids = filtered.filter((m) => m.status === "termine").map((m) => m.id);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: t("prestations.validateTitle", { count: ids.length, noun: copy.noun(ids.length) }),
      description: t("prestations.validateDesc"),
      confirmLabel: t("prestations.validateAll"),
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
      toast.success(tp("prestations.validated", succeeded, { noun: copy.noun(succeeded) }));
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    }
  };

  const handleDecide = async (r: RescheduleRequest, decision: "approved" | "rejected") => {
    try {
      await decide.mutateAsync({ id: r.id, decision, apply_to_menage: decision === "approved" });
      toast.success(decision === "approved" ? t("prestations.rescheduleAccepted") : t("prestations.rescheduleRejected"));
      qc.invalidateQueries({ queryKey: ["menages"] });
      qc.invalidateQueries({ queryKey: ["calendar-menages"] });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.failed"));
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
      toast.error(t("prestations.onlyFinishedValidable"));
      return;
    }
    const ok = await confirm({
      title: t("prestations.validateTitle", { count: ids.length, noun: copy.noun(ids.length) }),
      description:
        t("prestations.validateDesc") + (ignored > 0 ? ` ${tp("prestations.ignoredNotFinished", ignored)}` : ""),
      confirmLabel: t("common.validate"),
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
      toast.success(tp("prestations.validated", succeeded, { noun: copy.noun(succeeded) }));
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
      title: t("prestations.cancelTitle", { count: ids.length, noun: copy.noun(ids.length) }),
      description: t("prestations.cancelDesc"),
      tone: "danger",
      confirmLabel: t("prestations.cancelConfirm"),
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
      toast.success(tp("prestations.cancelled", succeeded, { noun: copy.noun(succeeded) }));
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
    setAvailabilityFilter("");
    setSearch("");
  };

  const handleRelance = async (m: CalendarMenage) => {
    setRelancingId(m.id);
    try {
      const { sent } = await relance.mutateAsync(m.id);
      toast.success(sent === 0 ? t("picker.everyoneAnswered") : tp("picker.relanceSent", sent));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("prestations.relanceFailed"));
    } finally {
      setRelancingId(null);
    }
  };

  // Filtres actifs (mémorisés, donc invisibles au 1er coup d'œil) → on les rend
  // explicites avec un bouton « Réinitialiser » pour éviter les « où sont mes
  // prestations ? » quand un filtre discret (créateur/presta/période) masque tout.
  const activeFilters = [logementFilter, prestaFilter, creatorFilter, availabilityFilter, search.trim()].filter(Boolean);
  const filterCount = [logementFilter, prestaFilter, creatorFilter, availabilityFilter].filter(Boolean).length;

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
    if (hasManual) result.push({ id: "src:manual", label: t("prestations.creatorManual") });
    for (const s of Array.from(sources).sort()) {
      const provider = s.replace(/^cal_/, "");
      const labelMap: Record<string, string> = {
        airbnb: "Airbnb",
        booking: "Booking",
        vrbo: "Vrbo",
        ical: "iCal",
      };
      result.push({ id: `src:${s}`, label: labelMap[provider] ?? t("prestations.creatorExternal") });
    }
    for (const id of userIds) result.push({ id: `user:${id}`, label: userName(id) });
    return result;
  }, [list.data, allUsers, t]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{copy.title}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {list.isLoading ? t("common.loading") : t("prestations.total", { count: total, noun: copy.noun(total) })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              aria-pressed={viewMode === "list"}
              aria-label={t("prestations.viewList")}
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
              aria-label={t("prestations.viewMap")}
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
              title={t("common.selectMany")}
            >
              <CheckSquare size={16} />
              {t("common.select")}
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
              {t("common.cancel")}
            </Button>
          ) : null}
        </div>
      </div>

      {selectionMode ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-900/20">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
            {tp("prestations.selected", selectedIds.size, { noun: copy.noun(selectedIds.size) })}
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
              title={t("prestations.validateOnlyFinishedTitle")}
            >
              <CheckCheck size={14} />
              {t("common.validate")}{validableCount > 0 ? ` (${validableCount})` : ""}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleBulkCancel}
              disabled={selectedIds.size === 0 || bulkBusy || deleting}
            >
              <Ban size={14} />
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || deleting || bulkBusy}
              loading={deleting}
            >
              <Trash2 size={14} />
              {t("common.delete")}
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
            placeholder={t("prestations.searchPlaceholder")}
            className="pl-9"
            wrapperClassName="w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-zinc-900">
          {(
            [
              { key: "planning" as const, label: t("prestations.viewPlanning"), badge: 0 },
              { key: "todo" as const, label: t("prestations.viewTodo"), badge: todoCount },
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
          title={t("prestations.filtersTitle")}
        >
          <SlidersHorizontal size={16} />
          {t("common.filters")}
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
          {t("nav.archives")}
        </Link>
      </div>

      {/* Filtres (logement ; prestataire + source pour l'admin), repliés derrière
          le bouton « Filtres » : ils sortent du chemin de la liste (parité mobile). */}
      <div className={cn("flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:items-center", !filtersOpen && "hidden")}>
        <Select
          aria-label={t("prestations.filterByLogement")}
          value={logementFilter}
          onChange={(e) => setLogementFilter(e.target.value)}
          className="sm:max-w-xs"
        >
          <option value="">{t("prestations.allLogements")}</option>
          {logementOptions.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        {isAdmin ? (
          <>
            <Select
              aria-label={t("prestations.filterByPresta")}
              value={prestaFilter}
              onChange={(e) => setPrestaFilter(e.target.value)}
              className="sm:max-w-xs"
            >
              <option value="">{t("prestations.allPrestas")}</option>
              <option value="__unassigned__">{t("prestation.unassigned")}</option>
              {prestaOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t("prestations.filterByCreator")}
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              className="sm:max-w-xs"
            >
              <option value="">{t("prestations.allCreators")}</option>
              {creatorOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </Select>
            <Select
              aria-label={t("prestations.filterByAvailability")}
              value={availabilityFilter}
              onChange={(e) => setAvailabilityFilter(e.target.value as AvailabilityFilter | "")}
              className="sm:max-w-xs"
            >
              <option value="">{t("prestations.allAvailability")}</option>
              <option value="available">{t("prestations.someoneAvailable")}</option>
              <option value="unavailable">{t("dispo.unavailable")}</option>
              <option value="no_response">{t("dispo.noResponse")}</option>
            </Select>
          </>
        ) : null}
        <button
          type="button"
          onClick={resetFilters}
          disabled={activeFilters.length === 0}
          className="text-xs font-semibold text-blue-600 hover:underline disabled:text-zinc-400 disabled:no-underline dark:text-blue-400 sm:ml-auto"
        >
          {t("common.reset")}
        </button>
      </div>

      {list.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {list.error instanceof Error ? list.error.message : t("common.loadError")}
        </Card>
      ) : null}

      {hiddenUnread.length > 0 ? (
        <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700 dark:text-rose-300">
              <Bell size={14} />
              {tp("prestations.hiddenUnread", hiddenUnread.length)}
            </p>
            <button
              type="button"
              onClick={resetFilters}
              className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-rose-600 underline hover:text-rose-700 dark:text-rose-300"
            >
              {t("common.resetFilters")}
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
                    {logementLabel(m, t)}
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
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        </Card>
      ) : viewMode === "map" ? (
        <MenagesMap menages={filtered} />
      ) : view === "todo" ? (
        todo.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={32} />}
            title={t("prestations.allDoneTitle")}
            description={t("prestations.allDoneDesc")}
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
                  {section.subtitle ? (
                    <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{section.subtitle}</span>
                  ) : null}
                  {section.key === "validate" && isAdmin && !selectionMode ? (
                    <Button size="sm" className="ml-auto" onClick={handleValidateAll} disabled={bulkBusy} loading={bulkBusy}>
                      <CheckCheck size={14} />
                      {t("prestations.validateAll")}
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
                            ? t("prestations.finishedOn", { date: formatDateFr(item.m.departed_at, "datetime") })
                            : t("prestations.reportSubmitted")
                          : section.key === "late"
                            ? t("prestations.lateNote")
                            : undefined,
                      )
                    ),
                  )}
                </div>
              </section>
            ))}
            <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
              {t("prestations.staleFooterPrefix", { days: PAST_WINDOW_DAYS })}{" "}
              <Link href="/archives" className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
                {t("prestations.staleFooterLink")}
              </Link>
              {t("prestations.staleFooterSuffix")}
            </p>
          </div>
        )
      ) : planningCount === 0 ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title={copy.emptyTitle}
          description={search || filterCount ? t("prestations.noneForFilters") : copy.emptyAll}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-4">
            {[
              { n: summary.today, label: t("prestations.summary.today"), cls: "text-zinc-900 dark:text-white" },
              { n: summary.enCours, label: t("prestations.summary.inProgress"), cls: "text-amber-600 dark:text-amber-400" },
              { n: summary.unassigned, label: t(pluralKey("prestations.summary.unassigned", summary.unassigned, locale)), cls: "text-blue-600 dark:text-blue-400" },
              { n: summary.late, label: t(pluralKey("prestations.summary.late", summary.late, locale)), cls: "text-rose-600 dark:text-rose-400" },
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

      {/* Affectation depuis une carte (« Affecter ») : prestation sans prestataire,
          donc on part d'une sélection vide. Remontée à chaque ouverture. */}
      {assignTarget ? (
        <PrestatairePickerModal
          key={assignTarget.id}
          menageId={assignTarget.id}
          currentIds={[]}
          open
          onClose={() => setAssignTarget(null)}
        />
      ) : null}
    </div>
  );

  // Carte d'une prestation (Planning et À traiter). Fonction de rendu (pas un
  // composant) : définie dans la fermeture pour accéder à la sélection et aux
  // non-lus sans changer d'identité à chaque rendu.
  function renderMenageCard(m: CalendarMenage, muted = false, note?: string) {
    {
            const unassigned = !m.prestataire_user_id;
            const canAct = isAdmin && !selectionMode && m.status === "a_venir";
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
                        {logementLabel(m, t)}
                        {m.logement_city ? (
                          <span className="text-zinc-400"> · {m.logement_city}</span>
                        ) : null}
                      </p>
                      {note ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{note}</p> : null}
                      <div className="mt-2 flex min-h-8 items-center gap-2">
                        {unassigned ? (
                          <>
                            <DispoBadge menage={m} className="min-w-0" />
                            {/* Boutons dans une carte-lien : on bloque la navigation.
                                Affecter = quelqu'un a répondu (dispo ou non) ; Relancer =
                                personne n'a répondu. Admin, prestation encore ouverte. */}
                            {canAct ? (
                              dispoState(m) === "no_response" ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void handleRelance(m);
                                  }}
                                  disabled={relancingId === m.id}
                                  className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                                >
                                  <Send size={12} />
                                  {relancingId === m.id ? t("common.sending") : t("prestations.relance")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setAssignTarget(m);
                                  }}
                                  className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2 text-xs font-semibold text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                                >
                                  <UserPlus size={12} />
                                  {t("common.assign")}
                                </button>
                              )
                            ) : null}
                          </>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <Avatar
                              firstName={m.prestataire_first_name ?? undefined}
                              lastName={m.prestataire_last_name ?? undefined}
                              src={m.prestataire_avatar_url ?? undefined}
                              size="sm"
                            />
                            <span className="text-xs text-zinc-600 dark:text-zinc-400">
                              {prestataireLabel(m, t)}
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
                            title={t("prestations.unreadTitle")}
                          >
                            <Bell size={10} />
                            {unreadByMenage[m.id] > 99 ? "99+" : unreadByMenage[m.id]}
                          </span>
                        ) : null}
                        {m.needs_attention ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                            <AlertTriangle size={10} />
                            {t("prestations.notClocked")}
                          </span>
                        ) : null}
                        {m.has_pending_reschedule ? (
                          <span
                            className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                            title={t("prestations.pendingRescheduleTitle")}
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
                            {t(STATUS_KEY[m.status])}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          prestationTypePill(m.prestation_type),
                        )}
                      >
                        {prestationTypeLabel(m.prestation_type, t)}
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
  teal: "text-teal-600 dark:text-teal-400",
  rose: "text-rose-600 dark:text-rose-400",
  blue: "text-blue-600 dark:text-blue-400",
  amber: "text-amber-600 dark:text-amber-400",
};
const TODO_COUNT: Record<string, string> = {
  purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
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
  const { t } = useI18n();
  const proposedDate = formatDateFr(r.proposed_date.slice(0, 10), "weekday");
  const proposed = r.proposed_time
    ? t("prestations.proposedAt", { date: proposedDate, time: r.proposed_time.slice(0, 5) })
    : proposedDate;
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
              {logementLabel(m, t)}
              {m.logement_city ? <span className="text-zinc-400"> · {m.logement_city}</span> : null}
            </p>
          ) : null}
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="font-medium text-zinc-900 dark:text-white">{requester}</span> {t("prestations.proposesVerb")}{" "}
            <span className="font-medium text-amber-700 dark:text-amber-300">{proposed}</span>
            {r.reason ? <span className="text-zinc-500"> · « {r.reason} »</span> : null}
          </p>
        </div>
        {m ? (
          <span className={cn("inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", prestationTypePill(m.prestation_type))}>
            {prestationTypeLabel(m.prestation_type, t)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex justify-end gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <Button variant="secondary" size="sm" onClick={() => onDecide(r, "rejected")} disabled={busy}>
          <X size={14} />
          {t("common.refuse")}
        </Button>
        <Button size="sm" onClick={() => onDecide(r, "approved")} disabled={busy}>
          <Check size={14} />
          {t("common.accept")}
        </Button>
      </div>
    </Card>
  );
}
