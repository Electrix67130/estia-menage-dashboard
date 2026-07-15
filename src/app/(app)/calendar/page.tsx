"use client";

import { useMemo, useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarDays, Plus, X, RefreshCw, AlertTriangle } from "lucide-react";
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
  // Vue semaine chronologique (blocs à l'échelle de la durée) vs grille mensuelle.
  const [weekView, setWeekView] = usePersistedState<boolean>("calendar.weekView", false);

  const { from, to } = useMemo(
    () => (weekView ? weekRange(cursor) : monthRange(cursor)),
    [cursor, weekView],
  );
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

  const byDate = useMemo(() => groupByDate(filteredMenages), [filteredMenages]);
  const days = useMemo(() => buildMonthGrid(cursor), [cursor]);
  const weekDays = useMemo(() => buildWeekDays(cursor), [cursor]);
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
              {weekView ? weekTitle(cursor) : formatDateFr(cursor, "month")}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {(() => {
                const total = menages.data?.meta.total ?? 0;
                const period = weekView ? "cette semaine" : "ce mois";
                return filtersActive
                  ? `${filteredCount} / ${total} ménage${total > 1 ? "s" : ""} ${period}`
                  : `${total} ménage${total > 1 ? "s" : ""} ${period}`;
              })()}
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
              checked={weekView}
              onChange={(e) => setWeekView(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Vue semaine (durées)
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(weekView ? addDays(cursor, -7) : addMonths(cursor, -1))}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(weekView ? new Date() : startOfMonth(new Date()))}
          >
            Aujourd&apos;hui
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCursor(weekView ? addDays(cursor, 7) : addMonths(cursor, 1))}
          >
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

      {weekView ? (
        <WeekTimeline weekDays={weekDays} byDate={byDate} todayIso={todayIso} />
      ) : (
      <Card className="p-0">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
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
                {/* Date number centrée + dots juste en-dessous */}
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
                      {dayMenages.slice(0, 5).map((m, i) =>
                        m.logement_color ? (
                          <span
                            key={i}
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: m.logement_color }}
                            title={`${m.horaire_prevu ? m.horaire_prevu.slice(0, 5) + " · " : ""}${m.status}`}
                          />
                        ) : (
                          <span
                            key={i}
                            className={`h-2 w-2 rounded-full ${STATUS_DOT[m.status]}`}
                            title={`${m.horaire_prevu ? m.horaire_prevu.slice(0, 5) + " · " : ""}${m.status}`}
                          />
                        ),
                      )}
                      {dayMenages.length > 5 ? (
                        <span className="text-[9px] font-bold text-zinc-500">+{dayMenages.length - 5}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                {/* Liste des ménages du jour (compacte) */}
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
                              ? {
                                  backgroundColor: m.logement_color ?? undefined,
                                  color: "#FFFFFF",
                                  borderLeft: `3px solid ${m.logement_color}`,
                                }
                              : undefined
                          }
                        >
                          {m.needs_attention ? (
                            <AlertTriangle size={9} className="flex-shrink-0 text-rose-500" />
                          ) : null}
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
            {weekView ? "Liste de la semaine" : "Liste du mois"}
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

const HOUR_PX = 44;
const WEEKDAYS_FULL = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

/**
 * Vue semaine chronologique : grille d'heures, chaque ménage est un bloc dont
 * la hauteur = sa durée estimée, positionné à son heure de début. Les ménages
 * sans heure sont listés dans une bande « sans heure » en haut de leur jour.
 */
function WeekTimeline({
  weekDays,
  byDate,
  todayIso,
}: {
  weekDays: Date[];
  byDate: Map<string, CalendarMenage[]>;
  todayIso: string;
}) {
  const perDay = weekDays.map((d) => {
    const iso = isoLocal(d);
    const events = byDate.get(iso) ?? [];
    return {
      d,
      iso,
      timed: layoutDay(events),
      untimed: events.filter((e) => !e.horaire_prevu),
    };
  });

  // Plage horaire affichée : au moins 7h–20h, élargie si des ménages débordent.
  let startHour = 7;
  let endHour = 20;
  for (const p of perDay) {
    for (const it of p.timed) {
      startHour = Math.min(startHour, Math.floor(it.startMin / 60));
      endHour = Math.max(endHour, Math.ceil(it.endMin / 60));
    }
  }
  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);
  const bodyHeight = (endHour - startHour) * HOUR_PX;
  const hasUntimed = perDay.some((p) => p.untimed.length > 0);
  const gridCols = "48px repeat(7, minmax(0, 1fr))";

  return (
    <Card className="overflow-x-auto p-0">
      <div className="min-w-[760px]">
        {/* En-têtes de jours */}
        <div className="grid border-b border-zinc-200 dark:border-zinc-800" style={{ gridTemplateColumns: gridCols }}>
          <div className="border-r border-zinc-100 dark:border-zinc-800" />
          {perDay.map((p) => {
            const isToday = p.iso === todayIso;
            return (
              <div
                key={p.iso}
                className="border-r border-zinc-100 py-2 text-center last:border-r-0 dark:border-zinc-800"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {WEEKDAYS_FULL[(p.d.getDay() + 6) % 7]}
                </div>
                <div
                  className={`mx-auto mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold ${
                    isToday ? "bg-blue-600 text-white" : "text-zinc-700 dark:text-zinc-200"
                  }`}
                >
                  {p.d.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bande « sans heure » */}
        {hasUntimed ? (
          <div className="grid border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40" style={{ gridTemplateColumns: gridCols }}>
            <div className="flex items-center justify-end pr-1 text-[9px] uppercase text-zinc-400">sans h.</div>
            {perDay.map((p) => (
              <div key={p.iso} className="flex flex-col gap-0.5 border-r border-zinc-100 p-1 last:border-r-0 dark:border-zinc-800">
                {p.untimed.map((m) => (
                  <TimelineChip key={m.id} m={m} />
                ))}
              </div>
            ))}
          </div>
        ) : null}

        {/* Corps chronologique */}
        <div className="grid" style={{ gridTemplateColumns: gridCols }}>
          {/* Gouttière des heures */}
          <div className="relative border-r border-zinc-100 dark:border-zinc-800" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <div
                key={h}
                className="absolute right-1 text-[10px] text-zinc-400"
                style={{ top: i * HOUR_PX - 6 }}
              >
                {String(h).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {perDay.map((p) => (
            <div
              key={p.iso}
              className="relative border-r border-zinc-100 last:border-r-0 dark:border-zinc-800"
              style={{ height: bodyHeight }}
            >
              {/* Lignes d'heures */}
              {hours.map((h, i) => (
                <div
                  key={h}
                  className="absolute inset-x-0 border-t border-zinc-100 dark:border-zinc-800/70"
                  style={{ top: i * HOUR_PX }}
                />
              ))}
              {/* Blocs ménages */}
              {p.timed.map((it) => {
                const top = ((it.startMin - startHour * 60) / 60) * HOUR_PX;
                const height = Math.max(((it.endMin - it.startMin) / 60) * HOUR_PX, 16);
                const widthPct = 100 / it.lanes;
                const bg = it.m.logement_color ?? STATUS_HEX[it.m.status];
                const unassigned = !it.m.prestataire_user_id;
                return (
                  <Link
                    key={it.m.id}
                    href={`/menages/${it.m.id}`}
                    title={`${fmtHm(it.startMin)}–${fmtHm(it.endMin)} · ${logementLabel(it.m)}`}
                    className={`absolute overflow-hidden rounded px-1 py-0.5 text-[10px] font-medium leading-tight text-white shadow-sm hover:opacity-90 ${
                      it.m.needs_attention ? "ring-1 ring-rose-400" : ""
                    }`}
                    style={{
                      top,
                      height,
                      left: `calc(${it.lane * widthPct}% + 1px)`,
                      width: `calc(${widthPct}% - 2px)`,
                      backgroundColor: bg,
                    }}
                  >
                    <span className="block truncate">
                      {fmtHm(it.startMin)} {unassigned ? "· Non assigné" : `· ${prestataireLabel(it.m)}`}
                    </span>
                    {height > 28 ? (
                      <span className="block truncate opacity-90">{logementLabel(it.m)}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function TimelineChip({ m }: { m: CalendarMenage }) {
  const bg = m.logement_color ?? STATUS_HEX[m.status];
  const unassigned = !m.prestataire_user_id;
  return (
    <Link
      href={`/menages/${m.id}`}
      className="truncate rounded px-1 py-0.5 text-[9px] font-medium text-white hover:opacity-90"
      style={{ backgroundColor: bg }}
      title={logementLabel(m)}
    >
      {unassigned ? "Non assigné" : prestataireLabel(m)}
    </Link>
  );
}

interface LaidOutEvent {
  m: CalendarMenage;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
}

/** Positionne les ménages horodatés d'un jour en couloirs (gestion des chevauchements). */
function layoutDay(events: CalendarMenage[]): LaidOutEvent[] {
  const timed: LaidOutEvent[] = events
    .filter((e) => e.horaire_prevu)
    .map((e) => {
      const startMin = minutesFromHoraire(e.horaire_prevu as string);
      const endMin = startMin + Math.max(e.duree_estimee_min ?? 60, 30);
      return { m: e, startMin, endMin, lane: 0, lanes: 1 };
    })
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);

  const result: LaidOutEvent[] = [];
  let i = 0;
  while (i < timed.length) {
    let j = i;
    let clusterEnd = timed[i].endMin;
    const laneEnds: number[] = [];
    const group: LaidOutEvent[] = [];
    while (j < timed.length && timed[j].startMin < clusterEnd) {
      let lane = laneEnds.findIndex((end) => end <= timed[j].startMin);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(timed[j].endMin);
      } else {
        laneEnds[lane] = timed[j].endMin;
      }
      timed[j].lane = lane;
      group.push(timed[j]);
      clusterEnd = Math.max(clusterEnd, timed[j].endMin);
      j++;
    }
    for (const g of group) {
      g.lanes = laneEnds.length;
      result.push(g);
    }
    i = j;
  }
  return result;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(d.getDate() + n);
  return x;
}

function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lundi
  x.setDate(x.getDate() - dow);
  return x;
}

function weekRange(cursor: Date): { from: string; to: string } {
  const s = weekStart(cursor);
  return { from: isoLocal(s), to: isoLocal(addDays(s, 6)) };
}

function buildWeekDays(cursor: Date): Date[] {
  const s = weekStart(cursor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function weekTitle(cursor: Date): string {
  const s = weekStart(cursor);
  const e = addDays(s, 6);
  if (s.getMonth() === e.getMonth()) {
    return `${s.getDate()} – ${e.getDate()} ${MONTHS_FR[s.getMonth()]} ${s.getFullYear()}`;
  }
  return `${s.getDate()} ${MONTHS_FR[s.getMonth()]} – ${e.getDate()} ${MONTHS_FR[e.getMonth()]} ${e.getFullYear()}`;
}

function minutesFromHoraire(h: string): number {
  const [hh, mm] = h.slice(0, 5).split(":").map(Number);
  return hh * 60 + (mm || 0);
}

function fmtHm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
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
