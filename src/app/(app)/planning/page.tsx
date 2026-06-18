"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, ChevronLeft, ChevronRight, AlertTriangle, Clock } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import {
  useCalendarMenages,
  useAssignMenagePrestataire,
  logementLabel,
  type CalendarMenage,
} from "@/hooks/useCalendarMenages";
import { useOrgPrestataires } from "@/hooks/useLogementMembers";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const UNASSIGNED = "__unassigned__";

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function mondayOf(offset: number): Date {
  const now = new Date();
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dow + offset * 7);
  return monday;
}

function startMin(m: CalendarMenage): number | null {
  if (!m.horaire_prevu) return null;
  const [h, min] = m.horaire_prevu.slice(0, 5).split(":").map(Number);
  return h * 60 + min;
}

function conflictingIds(menages: CalendarMenage[]): Set<string> {
  const conflicts = new Set<string>();
  const timed = menages
    .map((m) => ({ m, start: startMin(m), dur: m.duree_estimee_min ?? 60 }))
    .filter((x) => x.start !== null)
    .sort((a, b) => a.start! - b.start!);
  for (let i = 0; i < timed.length - 1; i++) {
    if (timed[i].start! + timed[i].dur > timed[i + 1].start!) {
      conflicts.add(timed[i].m.id);
      conflicts.add(timed[i + 1].m.id);
    }
  }
  return conflicts;
}

const STATUS_TINT: Record<CalendarMenage["status"], string> = {
  a_venir: "bg-sky-50 dark:bg-sky-950/30",
  en_cours: "bg-amber-50 dark:bg-amber-950/30",
  termine: "bg-emerald-50 dark:bg-emerald-950/30",
  valide: "bg-teal-50 dark:bg-teal-950/30",
  annule: "bg-zinc-100 dark:bg-zinc-800/40",
};

function ChipInner({ m, conflict }: { m: CalendarMenage; conflict: boolean }) {
  return (
    <>
      <span className="flex items-center gap-1 font-semibold text-zinc-800 dark:text-zinc-100">
        {conflict ? <AlertTriangle size={10} className="text-rose-500" /> : null}
        {m.horaire_prevu ? m.horaire_prevu.slice(0, 5) : "—"}
      </span>
      <span className="flex items-center gap-1 truncate text-zinc-500 dark:text-zinc-400">
        <span
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: m.logement_color ?? "#3b82f6" }}
        />
        <span className="truncate">{logementLabel(m)}</span>
      </span>
    </>
  );
}

function DraggableChip({
  m,
  conflict,
  onOpen,
}: {
  m: CalendarMenage;
  conflict: boolean;
  onOpen: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: m.id,
    data: { menage: m },
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      {...attributes}
      {...listeners}
      onClick={() => onOpen(m.id)}
      className={cn(
        "block w-full cursor-grab rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition-colors hover:brightness-95 active:cursor-grabbing",
        STATUS_TINT[m.status],
        conflict ? "border-rose-400 ring-1 ring-rose-300 dark:border-rose-700" : "border-transparent",
        isDragging && "opacity-40",
      )}
      title={conflict ? "Chevauchement horaire — glisser pour réaffecter" : "Glisser pour réaffecter"}
    >
      <ChipInner m={m} conflict={conflict} />
    </button>
  );
}

interface RowDef {
  key: string;
  label: string;
  first_name: string;
  last_name: string;
  avatar_url?: string;
}

function PrestaRow({
  row,
  days,
  byDay,
  conflicts,
  onOpen,
}: {
  row: RowDef;
  days: Date[];
  byDay: Map<string, CalendarMenage[]> | undefined;
  conflicts: Set<string>;
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: row.key });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "grid grid-cols-[160px_repeat(7,1fr)] border-b border-zinc-100 transition-colors dark:border-zinc-800/60",
        isOver && "bg-blue-50/70 ring-1 ring-inset ring-blue-300 dark:bg-blue-950/30",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        {row.key === UNASSIGNED ? (
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
            <Clock size={14} />
          </span>
        ) : (
          <Avatar firstName={row.first_name} lastName={row.last_name} src={row.avatar_url} size="sm" />
        )}
        <span className="truncate text-sm font-medium text-zinc-900 dark:text-white">{row.label}</span>
      </div>
      {days.map((d, i) => {
        const list = (byDay?.get(ymd(d)) ?? [])
          .slice()
          .sort((a, b) => (startMin(a) ?? 9999) - (startMin(b) ?? 9999));
        return (
          <div key={i} className="min-h-[64px] border-l border-zinc-100 p-1.5 dark:border-zinc-800/60">
            <div className="flex flex-col gap-1">
              {list.map((m) => (
                <DraggableChip key={m.id} m={m} conflict={conflicts.has(m.id)} onOpen={onOpen} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PlanningPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const router = useRouter();
  const [offset, setOffset] = useState(0);
  const [activeMenage, setActiveMenage] = useState<CalendarMenage | null>(null);
  const assign = useAssignMenagePrestataire();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const week = useMemo(() => {
    const monday = mondayOf(offset);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
    const f = (d: Date) => d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
    return {
      days,
      from: ymd(days[0]),
      to: ymd(days[6]),
      label: `${f(days[0])} – ${f(days[6])} ${days[6].getFullYear()}`,
    };
  }, [offset]);

  const menages = useCalendarMenages({ from: week.from, to: week.to });
  const prestataires = useOrgPrestataires();
  const todayYmd = ymd(new Date());

  const grid = useMemo(() => {
    const map = new Map<string, Map<string, CalendarMenage[]>>();
    for (const m of menages.data?.data ?? []) {
      if (m.status === "annule") continue;
      const key = m.prestataire_user_id ?? UNASSIGNED;
      const day = m.date_prevue.slice(0, 10);
      if (!map.has(key)) map.set(key, new Map());
      const byDay = map.get(key)!;
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(m);
    }
    return map;
  }, [menages.data]);

  const conflicts = useMemo(() => {
    const set = new Set<string>();
    for (const byDay of grid.values()) {
      for (const list of byDay.values()) {
        for (const id of conflictingIds(list)) set.add(id);
      }
    }
    return set;
  }, [grid]);

  const rows = useMemo<RowDef[]>(() => {
    const presta = (prestataires.data ?? [])
      .slice()
      .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
      .map((u) => ({
        key: u.id,
        label: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        avatar_url: u.avatar_url ?? undefined,
      }));
    return grid.has(UNASSIGNED)
      ? [{ key: UNASSIGNED, label: "Non assigné", first_name: "", last_name: "" }, ...presta]
      : presta;
  }, [prestataires.data, grid]);

  const onDragStart = (e: DragStartEvent) => {
    setActiveMenage((e.active.data.current?.menage as CalendarMenage) ?? null);
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveMenage(null);
    const m = e.active.data.current?.menage as CalendarMenage | undefined;
    const overId = e.over?.id as string | undefined;
    if (!m || !overId) return;
    const currentKey = m.prestataire_user_id ?? UNASSIGNED;
    if (overId === currentKey) return;
    const target = overId === UNASSIGNED ? null : overId;
    assign.mutate(
      { menageId: m.id, prestataire_user_id: target },
      {
        onSuccess: () => toast.success(target ? "Ménage réaffecté" : "Ménage désassigné"),
        onError: (err) =>
          toast.error(err instanceof ApiError ? err.message : "Échec de l'affectation"),
      },
    );
  };

  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Accès réservé aux administrateurs.</p>
        </Card>
      </div>
    );
  }

  const totalConflicts = conflicts.size;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <CalendarRange size={24} className="text-zinc-500" />
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Planning</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {totalConflicts > 0
                ? `${totalConflicts} ménage${totalConflicts > 1 ? "s" : ""} en chevauchement · glisse un ménage pour réaffecter`
                : "Glisse un ménage sur un prestataire pour l'affecter"}
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-1 py-0.5 dark:border-zinc-800 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setOffset((o) => o - 1)}
            aria-label="Semaine précédente"
            className="rounded-full p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[12rem] text-center text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {week.label}
          </span>
          <button
            type="button"
            onClick={() => setOffset((o) => o + 1)}
            aria-label="Semaine suivante"
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
              Cette semaine
            </button>
          ) : null}
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <Card className="overflow-x-auto p-0">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-[160px_repeat(7,1fr)] border-b border-zinc-200 dark:border-zinc-800">
              <div className="p-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Prestataire</div>
              {week.days.map((d, i) => {
                const isToday = ymd(d) === todayYmd;
                return (
                  <div
                    key={i}
                    className={cn(
                      "border-l border-zinc-200 p-3 text-center dark:border-zinc-800",
                      isToday && "bg-blue-50/60 dark:bg-blue-950/20",
                    )}
                  >
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">{WEEKDAYS[i]}</p>
                    <p className={cn("text-xs", isToday ? "font-bold text-blue-600 dark:text-blue-400" : "text-zinc-400")}>
                      {d.getDate()}
                    </p>
                  </div>
                );
              })}
            </div>

            {menages.isLoading ? (
              <p className="p-6 text-sm text-zinc-500">Chargement…</p>
            ) : rows.length === 0 ? (
              <p className="p-6 text-sm text-zinc-500">Aucun prestataire.</p>
            ) : (
              rows.map((row) => (
                <PrestaRow
                  key={row.key}
                  row={row}
                  days={week.days}
                  byDay={grid.get(row.key)}
                  conflicts={conflicts}
                  onOpen={(id) => router.push(`/menages/${id}`)}
                />
              ))
            )}
          </div>
        </Card>

        <DragOverlay>
          {activeMenage ? (
            <div className={cn("w-44 rounded-md border border-blue-400 px-1.5 py-1 text-[11px] leading-tight shadow-lg", STATUS_TINT[activeMenage.status])}>
              <ChipInner m={activeMenage} conflict={false} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
