"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import Input from "./Input";
import { useI18n } from "@/contexts/I18nContext";
import type { TFn } from "@/i18n/translations";
import { cn } from "@/lib/utils";

interface Props {
  label?: string;
  /** Valeur en minutes, sous forme de string ("" = non défini). */
  value: string;
  onChange: (minutes: string) => void;
}

const PRESETS = [30, 45, 60, 90, 120, 150, 180, 240];

function formatLabel(mins: number, t: TFn): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return t("ui.duration.minutes", { count: m });
  if (m === 0) return t("ui.duration.hours", { count: h });
  return t("ui.duration.hoursMinutes", { h, m });
}

export default function DurationPicker({ label, value, onChange }: Props) {
  const { t } = useI18n();
  const [showCustom, setShowCustom] = useState(false);
  const numericValue = value ? parseInt(value, 10) : null;
  const isPreset = numericValue !== null && PRESETS.includes(numericValue);
  const showCustomField = showCustom || (numericValue !== null && !isPreset);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{label ?? t("ui.duration.label")}</label>
        <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
          <Timer size={12} />
          {numericValue !== null ? formatLabel(numericValue, t) : t("ui.duration.notSet")}
          {numericValue !== null ? (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setShowCustom(false);
              }}
              className="ml-2 text-rose-600 hover:underline"
            >
              {t("ui.clear")}
            </button>
          ) : null}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((mins) => {
          const selected = numericValue === mins;
          return (
            <button
              key={mins}
              type="button"
              onClick={() => {
                onChange(String(mins));
                setShowCustom(false);
              }}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                selected
                  ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-500 dark:bg-blue-900/20 dark:text-blue-300"
                  : "border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              {formatLabel(mins, t)}
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
          {t("ui.duration.other")}
        </button>
      </div>
      {showCustomField ? (
        <Input
          type="number"
          min={0}
          max={1440}
          placeholder={t("ui.duration.customPlaceholder")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}
