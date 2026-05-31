"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import Input from "./Input";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  /** Valeur en minutes, sous forme de string ("" = non défini). */
  value: string;
  onChange: (minutes: string) => void;
}

const PRESETS = [
  { mins: 30, label: "30 min" },
  { mins: 45, label: "45 min" },
  { mins: 60, label: "1 h" },
  { mins: 90, label: "1 h 30" },
  { mins: 120, label: "2 h" },
  { mins: 150, label: "2 h 30" },
  { mins: 180, label: "3 h" },
  { mins: 240, label: "4 h" },
];

function formatLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

export default function DurationPicker({ label = "Durée", value, onChange }: Props) {
  const [showCustom, setShowCustom] = useState(false);
  const numericValue = value ? parseInt(value, 10) : null;
  const isPreset = numericValue !== null && PRESETS.some((p) => p.mins === numericValue);
  const showCustomField = showCustom || (numericValue !== null && !isPreset);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label}</label>
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
          <Timer size={12} />
          {numericValue !== null ? formatLabel(numericValue) : "Non définie"}
          {numericValue !== null ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setShowCustom(false);
              }}
              className="ml-2 text-rose-600 hover:underline"
            >
              Effacer
            </button>
          ) : null}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => {
          const selected = numericValue === p.mins;
          return (
            <button
              key={p.mins}
              type="button"
              onClick={() => {
                onChange(String(p.mins));
                setShowCustom(false);
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                selected
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              {p.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setShowCustom((s) => !s)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            showCustomField
              ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300"
              : "border-dashed border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
          )}
        >
          Autre
        </button>
      </div>
      {showCustomField ? (
        <Input
          type="number"
          min={0}
          max={1440}
          placeholder="Durée en minutes (ex. 75)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}
