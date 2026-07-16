"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, X, RefreshCw, AlertTriangle, LogIn, LogOut } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useAuth } from "@/contexts/AuthContext";
import { useCalendarMenages, CalendarMenage, prestataireLabel, logementLabel } from "@/hooks/useCalendarMenages";
import { prestationTypeLabel, type PrestationType } from "@/lib/prestation";
import { useLogementsList } from "@/hooks/useLogementsList";
import { apiFetch } from "@/lib/api";
import { formatDateFr } from "@/lib/date-fr";
import type { User, PaginatedResponse } from "@/types/api";

const PRESTATAIRE_ALL = "";
const PRESTATAIRE_UNASSIGNED = "__unassigned__";
const LOGEMENT_ALL = "";
const TYPE_ALL = "";
const PRESTATION_TYPES: PrestationType[] = ["menage", "check_in", "check_out"];

const WEEKDAYS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

const STATUS_DOT: Record<CalendarMenage["status"], string> = {
  a_venir: "bg-sky-500",
  en_cours: "bg-amber-500",
  termine: "bg-purple-500",
  valide: "bg-emerald-500",
  annule: "bg-zinc-400",
};

export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [prestataireFilter, setPrestataireFilter] = usePersistedState<string>(
    "calendar.filter.prestataire",
    PRESTATAIRE_ALL,
  );
  const [logementFilter, setLogementFilter] = usePersistedState<string>(
    "calendar.filter.logement",
    LOGEMENT_ALL,
  );
  const [typeFilter, setTypeFilter] = usePersistedState<string>(
    "calendar.filter.type",
    TYPE_ALL,
  );
  const { from, to } = useMemo(() => monthRange(cursor), [cursor]);
  const menages = useCalendarMenages({ from, to });
  const allMenages = useMemo(() => menages.data?.data ?? [], [menages.data]);
  // Fetch tous les users de l'org pour qu'un prestataire sans ménage ce mois
  // apparaisse quand même dans le filtre (cas dispo).
  const usersQuery = useQuery({
    queryKey: ["users", "list"],
    queryFn: () => apiFetch<PaginatedResponse<User>>("/users?limit=200"),
    staleTime: 60_000,
  });

  const prestataireOptions = useMemo(
    () => buildPrestataireOptions(allMenages, usersQuery.data?.data ?? []),
    [allMenages, usersQuery.data],
  );
  // On charge tous les logements de l'org (et pas seulement ceux du mois affiché)
  // pour que le filtre liste TOUS les logements, même ceux sans ménage ce mois.
  const allLogements = useLogementsList();
  const logementOptions = useMemo(() => {
    return (allLogements.data?.data ?? [])
      .filter((l) => !l.archived_at)
      .map((l) => ({ id: l.id, label: l.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [allLogements.data]);

  const filteredMenages = useMemo(
    () =>
      allMenages.filter((m) => {
        if (prestataireFilter === PRESTATAIRE_UNASSIGNED) {
          if (m.prestataire_user_id) return false;
        } else if (prestataireFilter) {
          if (m.prestataire_user_id !== prestataireFilter) return false;
        }
        if (typeFilter && m.prestation_type !== typeFilter) return false;
        if (logementFilter && m.logement_id !== logementFilter) return false;
        return true;
      }),
    [allMenages, prestataireFilter, typeFilter, logementFilter],
  );

  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const byDate = useMemo(() => groupByDate(filteredMenages), [filteredMenages]);
  // Séjours = barres multi-jours (check-in → check-out). Le ménage est créé le
  // jour du check-out (date_prevue) ; l'arrivée = date_prevue − stay_nights.
  const spans = useMemo(() => buildSpans(filteredMenages), [filteredMenages]);
  // Vue « séjours » (barres multi-jours) vs vue classique (pastilles + liste).
  const [spanView, setSpanView] = usePersistedState<boolean>("calendar.spanView", false);
  const todayIso = isoLocal(new Date());
  const filtersActive =
    prestataireFilter !== PRESTATAIRE_ALL ||
    logementFilter !== LOGEMENT_ALL ||
    typeFilter !== TYPE_ALL;
  const filteredCount = filteredMenages.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-zinc-500" />
          <div>
            <h1 className="text-2xl font-bold capitalize text-zinc-900 dark:text-white">
              {formatDateFr(cursor, "month")}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {filtersActive
                ? `${filteredCount} / ${menages.data?.meta.total ?? 0} ménage${(menages.data?.meta.total ?? 0) > 1 ? "s" : ""} ce mois`
                : `${menages.data?.meta.total ?? 0} ménage${(menages.data?.meta.total ?? 0) > 1 ? "s" : ""} ce mois`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void menages.refetch();
              void usersQuery.refetch();
            }}
            disabled={menages.isFetching || usersQuery.isFetching}
            aria-label="Rafraîchir"
          >
            <RefreshCw size={14} className={menages.isFetching || usersQuery.isFetching ? "animate-spin" : undefined} />
          </Button>
          <label className="mr-1 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={spanView}
              onChange={(e) => setSpanView(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Vue séjours
          </label>
          <Button variant="ghost" size="sm" onClick={() => setCursor(addMonths(cursor, -1))}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Aujourd&apos;hui
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight size={16} />
          </Button>
          {isAdmin ? (
            <Link href="/menages/new">
              <Button size="sm">
                <Plus size={16} />
                Créer
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {menages.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          Erreur de chargement :{" "}
          {menages.error instanceof Error ? menages.error.message : String(menages.error)}
        </Card>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Select
            label="Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value={TYPE_ALL}>Tous</option>
            {PRESTATION_TYPES.map((t) => (
              <option key={t} value={t}>
                {prestationTypeLabel(t)}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Select
            label="Prestataire"
            value={prestataireFilter}
            onChange={(e) => setPrestataireFilter(e.target.value)}
          >
            <option value={PRESTATAIRE_ALL}>Tous</option>
            <option value={PRESTATAIRE_UNASSIGNED}>Non assigné</option>
            {prestataireOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex-1">
          <Select
            label="Logement"
            value={logementFilter}
            onChange={(e) => setLogementFilter(e.target.value)}
          >
            <option value={LOGEMENT_ALL}>Tous</option>
            {logementOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        {filtersActive ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPrestataireFilter(PRESTATAIRE_ALL);
              setLogementFilter(LOGEMENT_ALL);
              setTypeFilter(TYPE_ALL);
            }}
          >
            <X size={14} />
            Réinitialiser
          </Button>
        ) : null}
      </div>

      {spanView ? (
        <MonthSpanGrid days={days} spans={spans} todayIso={todayIso} />
      ) : (
        <MonthClassicGrid days={days} byDate={byDate} todayIso={todayIso} />
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <span>Légende :</span>
        <Legend dot="bg-sky-500" label="À venir" />
        <Legend dot="bg-amber-500" label="En cours" />
        <Legend dot="bg-emerald-500" label="Terminé" />
        <Legend dot="bg-teal-500" label="Validé" />
        <Legend dot="bg-zinc-400" label="Annulé" />
      </div>

      {filteredMenages.length > 0 ? (
        <Card className="p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">
            Liste du mois
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {filteredMenages
              .slice()
              .sort((a, b) => a.date_prevue.slice(0, 10).localeCompare(b.date_prevue.slice(0, 10)))
              .map((m) => {
                const unassigned = !m.prestataire_user_id;
                return (
                  <li key={m.id}>
                    <Link
                      href={`/menages/${m.id}`}
                      className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-600"
                    >
                      <div className="flex items-center gap-2">
                        {m.logement_color ? (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: m.logement_color }}
                          />
                        ) : (
                          <span className={`h-2 w-2 rounded-full ${STATUS_DOT[m.status]}`} />
                        )}
                        <span>{formatDateFr(m.date_prevue.slice(0, 10), "long")}</span>
                        {m.horaire_prevu ? (
                          <span className="text-zinc-400">{m.horaire_prevu.slice(0, 5)}</span>
                        ) : null}
                        <span className="text-zinc-400">·</span>
                        {unassigned ? (
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Non assigné
                          </span>
                        ) : (
                          <span className="text-zinc-700 dark:text-zinc-200">
                            {prestataireLabel(m)}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-zinc-500">{m.status}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

const STATUS_HEX: Record<CalendarMenage["status"], string> = {
  a_venir: "#0ea5e9",
  en_cours: "#f59e0b",
  termine: "#a855f7",
  valide: "#10b981",
  annule: "#a1a1aa",
};

const SPAN_LANE_H = 22; // hauteur d'une barre de séjour (px)
const MAX_LANES = 4; // au-delà, on agrège en « +N »

interface Span {
  key: string;
  startIso: string; // jour d'arrivée (check-in)
  endIso: string; // jour de départ (check-out / ménage)
  color: string;
  label: string;
  needsAttention: boolean;
  /** true = séjour multi-jours → demi-journées aux extrémités (turnover côte à côte). */
  isStay: boolean;
  /** Nature pour la géométrie 1 jour : 'stay' (séjour iCal), ou le type de la presta. */
  kind: "stay" | "menage" | "check_in" | "check_out";
  startId: string; // clic sur le jour d'arrivée → check-in (ou ménage)
  endId: string; // clic sur le jour de départ → check-out (ou ménage)
  midId: string; // clic au milieu → ménage
  hasCheckIn: boolean;
  hasCheckOut: boolean;
  checkInTime: string | null;
  checkOutTime: string | null;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

/** Index de jour absolu (pour la géométrie des barres). */
function dayIndex(iso: string): number {
  return Math.round(new Date(`${iso}T00:00:00Z`).getTime() / 86400000);
}

/**
 * Regroupe ménage / check-in / check-out d'une même réservation (external_event_uid)
 * en un séjour ; les ménages manuels (sans uid) deviennent des événements 1 jour.
 */
function buildSpans(menages: CalendarMenage[]): Span[] {
  const groups = new Map<string, CalendarMenage[]>();
  const singles: CalendarMenage[] = [];
  for (const m of menages) {
    if (m.external_event_uid) {
      const arr = groups.get(m.external_event_uid) ?? [];
      arr.push(m);
      groups.set(m.external_event_uid, arr);
    } else {
      singles.push(m);
    }
  }

  const spans: Span[] = [];
  for (const rows of groups.values()) {
    const menage = rows.find((r) => r.prestation_type === "menage");
    const checkIn = rows.find((r) => r.prestation_type === "check_in");
    const checkOut = rows.find((r) => r.prestation_type === "check_out");
    const anchor = menage ?? checkOut ?? checkIn ?? rows[0];
    const endIso = (checkOut ?? menage ?? anchor).date_prevue.slice(0, 10);
    let startIso: string;
    if (checkIn) startIso = checkIn.date_prevue.slice(0, 10);
    else if (menage?.stay_nights) startIso = isoLocal(addDays(new Date(`${endIso}T00:00:00`), -menage.stay_nights));
    else startIso = endIso;
    spans.push({
      key: anchor.id,
      startIso,
      endIso,
      color: anchor.logement_color ?? STATUS_HEX[anchor.status],
      label: anchor.prestataire_user_id ? prestataireLabel(anchor) : "Non assigné",
      needsAttention: rows.some((r) => r.needs_attention),
      isStay: startIso < endIso,
      kind: "stay",
      startId: (checkIn ?? menage ?? anchor).id,
      endId: (checkOut ?? menage ?? anchor).id,
      midId: (menage ?? anchor).id,
      hasCheckIn: !!checkIn,
      hasCheckOut: !!checkOut,
      checkInTime: checkIn?.horaire_prevu?.slice(0, 5) ?? null,
      checkOutTime: checkOut?.horaire_prevu?.slice(0, 5) ?? null,
    });
  }

  for (const m of singles) {
    const endIso = m.date_prevue.slice(0, 10);
    const startIso = m.stay_nights
      ? isoLocal(addDays(new Date(`${endIso}T00:00:00`), -m.stay_nights))
      : endIso;
    spans.push({
      key: m.id,
      startIso,
      endIso,
      color: m.logement_color ?? STATUS_HEX[m.status],
      label: m.prestataire_user_id ? prestataireLabel(m) : "Non assigné",
      needsAttention: !!m.needs_attention,
      isStay: startIso < endIso,
      kind: m.prestation_type,
      startId: m.id,
      endId: m.id,
      midId: m.id,
      hasCheckIn: m.prestation_type === "check_in",
      hasCheckOut: m.prestation_type === "check_out",
      checkInTime: m.horaire_prevu?.slice(0, 5) ?? null,
      checkOutTime: null,
    });
  }
  return spans.sort((a, b) => a.startIso.localeCompare(b.startIso) || a.endIso.localeCompare(b.endIso));
}

/**
 * Grille mensuelle avec barres de séjour. Un séjour occupe des demi-journées à
 * ses extrémités (check-in l'après-midi, check-out le matin) → un check-out et
 * un check-in le même jour tiennent CÔTE À CÔTE dans le même couloir (pas de
 * superposition). Le clic mène au check-in / check-out / ménage selon le jour.
 */
function MonthSpanGrid({
  days,
  spans,
  todayIso,
}: {
  days: { date: Date; inMonth: boolean }[];
  spans: Span[];
  todayIso: string;
}) {
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  // Jours où un check-in a lieu (iCal OU manuel) → un ménage 1 jour ce jour-là
  // ne prend que le matin (moitié gauche) pour laisser l'après-midi au check-in.
  const checkInDays = new Set<number>();
  for (const s of spans) if (s.hasCheckIn) checkInDays.add(dayIndex(s.startIso));

  // Intervalle numérique [lo, hi]. Demi-journées : check-in = après-midi (droite),
  // check-out = matin (gauche), séjour iCal = de l'après-midi d'arrivée au matin
  // du départ. Un ménage prend toute la journée, sauf s'il partage sa date avec
  // un check-in → il se scinde (matin).
  const geom = (s: Span) => {
    const si = dayIndex(s.startIso);
    const ei = dayIndex(s.endIso);
    if (s.isStay) return { si, ei, lo: si + 0.5, hi: ei + 0.5 };
    if (s.kind === "check_in") return { si, ei, lo: si + 0.5, hi: si + 1 };
    if (s.kind === "check_out") return { si, ei, lo: si, hi: si + 0.5 };
    return { si, ei, lo: si, hi: checkInDays.has(si) ? si + 0.5 : si + 1 };
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week, wi) => {
        const w0 = dayIndex(isoLocal(week[0].date));
        const w6 = w0 + 6;
        const inWeek = spans
          .map((s) => ({ s, g: geom(s) }))
          .filter(({ g }) => g.hi > w0 && g.lo < w6 + 1);
        // Couloirs : first-fit sur la semaine (deux barres qui se touchent = même couloir).
        const laneHi: number[] = [];
        const laneOf = new Map<string, number>();
        for (const { s, g } of inWeek) {
          let lane = laneHi.findIndex((hi) => hi <= g.lo);
          if (lane === -1) {
            lane = laneHi.length;
            laneHi.push(0);
          }
          laneHi[lane] = g.hi;
          laneOf.set(s.key, lane);
        }
        const laneCount = Math.min(laneHi.length, MAX_LANES);

        return (
          <div key={wi} className="grid grid-cols-7 border-b border-zinc-100 last:border-b-0 dark:border-zinc-800">
            {week.map((cell, di) => {
              const dayIdx = w0 + di;
              const iso = isoLocal(cell.date);
              const isToday = iso === todayIso;
              const hidden = inWeek.filter(
                ({ s, g }) => g.lo < dayIdx + 1 && g.hi > dayIdx && (laneOf.get(s.key) ?? 0) >= MAX_LANES,
              ).length;
              return (
                <div
                  key={iso}
                  className={`min-h-[112px] border-r border-zinc-100 last:border-r-0 dark:border-zinc-800 ${
                    cell.inMonth ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/50 dark:bg-zinc-900/30"
                  }`}
                >
                  <div className="flex justify-center pt-1">
                    <div
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : cell.inMonth
                            ? "text-zinc-700 dark:text-zinc-200"
                            : "text-zinc-400 dark:text-zinc-600"
                      }`}
                    >
                      {cell.date.getDate()}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    {Array.from({ length: laneCount }).map((_, lane) => {
                      const hit = inWeek.find(
                        ({ s, g }) => laneOf.get(s.key) === lane && g.lo < dayIdx + 1 && g.hi > dayIdx,
                      );
                      if (!hit) return <div key={lane} style={{ height: SPAN_LANE_H }} />;
                      const { s, g } = hit;
                      const segLo = Math.max(g.lo, dayIdx);
                      const segHi = Math.min(g.hi, dayIdx + 1);
                      const leftPct = (segLo - dayIdx) * 100;
                      const widthPct = (segHi - segLo) * 100;
                      const roundLeft = segLo === g.lo;
                      const roundRight = segHi === g.hi;
                      const isStartDay = dayIdx === g.si;
                      const isEndDay = dayIdx === g.ei;
                      const href = isStartDay ? s.startId : isEndDay ? s.endId : s.midId;
                      return (
                        <div key={lane} className="relative" style={{ height: SPAN_LANE_H }}>
                          <Link
                            href={`/menages/${href}`}
                            title={`${s.label} · ${s.startIso}${s.checkInTime ? " " + s.checkInTime : ""} → ${s.endIso}${s.checkOutTime ? " " + s.checkOutTime : ""}`}
                            className={`absolute inset-y-0 flex items-center gap-0.5 overflow-hidden px-1 text-[10px] font-medium text-white hover:brightness-110 ${
                              roundLeft ? "rounded-l" : ""
                            } ${roundRight ? "rounded-r" : ""} ${s.needsAttention ? "ring-1 ring-rose-400" : ""}`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: s.color }}
                          >
                            {isStartDay && s.hasCheckIn ? (
                              <>
                                <LogIn size={9} className="flex-shrink-0" />
                                <span className="truncate">{s.checkInTime ?? "arrivée"}</span>
                              </>
                            ) : isEndDay && s.hasCheckOut ? (
                              <>
                                <LogOut size={9} className="flex-shrink-0" />
                                <span className="truncate">{s.checkOutTime ?? "départ"}</span>
                              </>
                            ) : di === 0 || isStartDay ? (
                              <span className="truncate">{s.label}</span>
                            ) : null}
                          </Link>
                        </div>
                      );
                    })}
                    {hidden > 0 ? <span className="px-1 text-[9px] font-bold text-zinc-500">+{hidden}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </Card>
  );
}

/** Vue mensuelle classique : numéro du jour + pastilles + liste des ménages du jour. */
function MonthClassicGrid({
  days,
  byDate,
  todayIso,
}: {
  days: { date: Date; inMonth: boolean }[];
  byDate: Map<string, CalendarMenage[]>;
  todayIso: string;
}) {
  return (
    <Card className="p-0">
      <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map(({ date, inMonth }) => {
          const iso = isoLocal(date);
          const dayMenages = byDate.get(iso) ?? [];
          const isToday = iso === todayIso;
          const hasMenages = dayMenages.length > 0;
          return (
            <div
              key={iso}
              className={`flex min-h-[110px] flex-col items-stretch border-b border-r border-zinc-100 p-2 text-xs last:border-r-0 dark:border-zinc-800 ${
                inMonth ? "bg-white dark:bg-zinc-950" : "bg-zinc-50/50 dark:bg-zinc-900/30"
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold ${
                    isToday
                      ? "bg-blue-600 text-white"
                      : inMonth
                        ? "text-zinc-700 dark:text-zinc-200"
                        : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  {date.getDate()}
                </div>
                {hasMenages ? (
                  <div className="flex items-center justify-center gap-1">
                    {dayMenages.slice(0, 5).map((m, i) => (
                      <span
                        key={i}
                        className={`h-2 w-2 rounded-full ${m.logement_color ? "" : STATUS_DOT[m.status]}`}
                        style={m.logement_color ? { backgroundColor: m.logement_color } : undefined}
                        title={`${m.horaire_prevu ? m.horaire_prevu.slice(0, 5) + " · " : ""}${m.status}`}
                      />
                    ))}
                    {dayMenages.length > 5 ? (
                      <span className="text-[9px] font-bold text-zinc-500">+{dayMenages.length - 5}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {hasMenages ? (
                <div className="mt-2 flex flex-col gap-0.5">
                  {dayMenages.slice(0, 3).map((m) => {
                    const unassigned = !m.prestataire_user_id;
                    const hasColor = !!m.logement_color;
                    return (
                      <Link
                        key={m.id}
                        href={`/menages/${m.id}`}
                        title={m.needs_attention ? "Jour passé sans pointage" : undefined}
                        className={`flex items-center gap-0.5 truncate rounded px-1 py-0.5 text-[10px] font-medium hover:opacity-90${
                          m.needs_attention ? " ring-1 ring-rose-500 dark:ring-rose-400" : ""
                        }`}
                        style={
                          hasColor
                            ? { backgroundColor: m.logement_color ?? undefined, color: "#FFFFFF", borderLeft: `3px solid ${m.logement_color}` }
                            : undefined
                        }
                      >
                        {m.needs_attention ? <AlertTriangle size={9} className="flex-shrink-0 text-rose-500" /> : null}
                        {m.horaire_prevu ? `${m.horaire_prevu.slice(0, 5)} · ` : ""}
                        {unassigned ? (
                          <span className="rounded bg-blue-100 px-1 py-px text-[9px] font-bold uppercase text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            Non assigné
                          </span>
                        ) : (
                          prestataireLabel(m)
                        )}
                      </Link>
                    );
                  })}
                  {dayMenages.length > 3 ? (
                    <span className="text-[10px] text-zinc-400">
                      +{dayMenages.length - 3} autre{dayMenages.length - 3 > 1 ? "s" : ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function isoLocal(d: Date) {
  // Format YYYY-MM-DD en local (pas UTC)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRange(cursor: Date): { from: string; to: string } {
  const first = startOfMonth(cursor);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  return { from: isoLocal(first), to: isoLocal(last) };
}

function buildMonthGrid(cursor: Date): { date: Date; inMonth: boolean }[] {
  const first = startOfMonth(cursor);
  // Day-of-week index where 0 = lundi (le calendrier FR commence lundi)
  const firstDow = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstDow);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === cursor.getMonth() });
  }
  return cells;
}

function buildPrestataireOptions(
  menages: CalendarMenage[],
  users: User[],
): { id: string; label: string }[] {
  const map = new Map<string, string>();
  // 1. Tous les users role='prestataire' de l'org — apparaissent même sans
  //    ménage ce mois (utile pour voir leur dispo ou les affecter).
  for (const u of users) {
    if (u.role !== "prestataire") continue;
    const label = [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || "—";
    map.set(u.id, label);
  }
  // 2. Filet : prestataires affectés à des ménages mais absents de la liste users.
  for (const m of menages) {
    if (!m.prestataire_user_id) continue;
    if (!map.has(m.prestataire_user_id)) {
      map.set(m.prestataire_user_id, prestataireLabel(m));
    }
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

function buildLogementOptions(
  menages: CalendarMenage[],
): { id: string; label: string }[] {
  const map = new Map<string, string>();
  for (const m of menages) {
    if (!map.has(m.logement_id)) {
      map.set(m.logement_id, logementLabel(m));
    }
  }
  return Array.from(map.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

function groupByDate(menages: CalendarMenage[]): Map<string, CalendarMenage[]> {
  const map = new Map<string, CalendarMenage[]>();
  for (const m of menages) {
    // L'API peut renvoyer "YYYY-MM-DD" ou "YYYY-MM-DDTHH:mm:ss.sssZ".
    // On normalise sur les 10 premiers caractères pour la clé.
    const key = m.date_prevue.slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(m);
    map.set(key, arr);
  }
  return map;
}
