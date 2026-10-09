"use client";

import { toast } from "sonner";
import { Bell } from "lucide-react";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import {
  useLogementNotificationLevel,
  useSetLogementNotificationLevel,
  type LogementNotificationLevel as Level,
} from "@/hooks/useNotificationPreferences";

const LEVELS: Level[] = ["all", "important", "none"];

/** Mes notifications pour ce logement : tout, l'important, ou rien. Réglage personnel. */
export default function LogementNotificationLevel({ logementId }: { logementId: string }) {
  const { t } = useI18n();
  const current = useLogementNotificationLevel(logementId);
  const setLevel = useSetLogementNotificationLevel();
  const level = current.data?.level ?? "all";

  const choose = (next: Level) =>
    setLevel.mutate(
      { logementId, level: next },
      {
        onSuccess: () => current.refetch(),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
      },
    );

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <Bell size={16} className="text-zinc-400" />
        <span className="font-medium">{t("notifPrefs.logementLabel")}</span>
      </div>
      <div role="radiogroup" aria-label={t("notifPrefs.logementLabel")} className="flex flex-col gap-1">
        <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
          {LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              disabled={current.isLoading || setLevel.isPending}
              onClick={() => choose(l)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                level === l
                  ? "bg-blue-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
              )}
            >
              {t(`notifPrefs.level.${l}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500 sm:text-right">{t(`notifPrefs.levelDesc.${level}`)}</p>
      </div>
    </div>
  );
}
