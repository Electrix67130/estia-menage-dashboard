"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Grille du mois (lundi en premier) : null pour les cases avant le 1er. */
function buildMonthGrid(view: Date): (Date | null)[] {
  const y = view.getFullYear();
  const m = view.getMonth();
  const startOffset = (new Date(y, m, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d));
  return cells;
}

interface Props {
  label?: string;
  /** Valeur au format YYYY-MM-DD. */
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  id?: string;
  className?: string;
}

/** Sélecteur de date custom (popover calendrier) — cohérent avec le thème de l'app. */
export default function DatePicker({ label, value, onChange, required, id, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(`${value}T00:00:00`) : null;
  const [view, setView] = useState<Date>(() => selected ?? new Date());

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const toggle = () => {
    // Au moment d'ouvrir, on cale le calendrier sur la date sélectionnée.
    if (!open && selected) setView(selected);
    setOpen((o) => !o);
  };

  const grid = useMemo(() => buildMonthGrid(view), [view]);
  const todayYmd = ymd(new Date());

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
          {required ? <span className="text-rose-500"> *</span> : null}
        </label>
      ) : null}
      <div className="relative" ref={ref}>
        <button
          id={id}
          type="button"
          onClick={toggle}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <span className={value ? "" : "text-zinc-400"}>
            {selected
              ? selected.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
              : "Choisir une date"}
          </span>
          <Calendar size={16} className="text-zinc-400" />
        </button>

        {open ? (
          <div className="absolute left-0 z-50 mt-1 w-72 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                aria-label="Mois précédent"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold capitalize text-zinc-900 dark:text-white">
                {view.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </span>
              <button
                type="button"
                onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                aria-label="Mois suivant"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-medium text-zinc-400">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-0.5">
              {grid.map((cell, i) => {
                if (!cell) return <span key={i} />;
                const cellYmd = ymd(cell);
                const isSelected = cellYmd === value;
                const isToday = cellYmd === todayYmd;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onChange(cellYmd);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors",
                      isSelected
                        ? "bg-blue-600 font-semibold text-white"
                        : isToday
                          ? "border border-blue-500 text-blue-600 dark:text-blue-400"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                    )}
                  >
                    {cell.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
