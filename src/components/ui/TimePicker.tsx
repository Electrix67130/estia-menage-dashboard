"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  /** Valeur au format HH:MM ("" = non défini). */
  value: string;
  onChange: (value: string) => void;
  /** Pas en minutes entre les créneaux proposés (défaut 15). */
  step?: number;
  id?: string;
  className?: string;
}

/** Sélecteur d'heure custom (liste de créneaux) — cohérent avec le thème de l'app. */
export default function TimePicker({ label, value, onChange, step = 15, id, className }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const slots = useMemo(() => {
    const out: string[] = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += step) {
        out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return out;
  }, [step]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    // Place la liste sur le créneau sélectionné à l'ouverture.
    const active = listRef.current?.querySelector("[data-active='true']");
    if (active) active.scrollIntoView({ block: "center" });
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {label}
        </label>
      ) : null}
      <div className="relative" ref={ref}>
        <button
          id={id}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex h-10 w-full items-center justify-between rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <span className={value ? "" : "text-zinc-400"}>{value || "Choisir une heure"}</span>
          <Clock size={16} className="text-zinc-400" />
        </button>

        {open ? (
          <div
            ref={listRef}
            className="absolute left-0 z-50 mt-1 max-h-60 w-full min-w-[8rem] overflow-auto rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          >
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="flex w-full items-center rounded-lg px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              — Aucune
            </button>
            {slots.map((s) => {
              const active = s === value;
              return (
                <button
                  key={s}
                  type="button"
                  data-active={active}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center rounded-lg px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-blue-600 font-semibold text-white"
                      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
                  )}
                >
                  {s}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
