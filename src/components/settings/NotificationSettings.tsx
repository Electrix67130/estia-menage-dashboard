"use client";

import { toast } from "sonner";
import { BellOff } from "lucide-react";
import Card from "@/components/ui/Card";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import {
  NOTIFICATION_CATEGORIES,
  useNotificationPreferences,
  useSetLogementNotificationLevel,
  useUpdateNotificationPreference,
} from "@/hooks/useNotificationPreferences";

/**
 * Réglages des notifications de l'application mobile (inspirés de Buildr) :
 * l'interrupteur général, une case par type d'événement, et les logements dont
 * le réglage n'est pas « tout » (réglables depuis la fiche de chaque logement).
 */
export default function NotificationSettings({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useI18n();
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreference();
  const setLevel = useSetLogementNotificationLevel();
  const onError = (err: unknown) => toast.error(err instanceof ApiError ? err.message : t("common.error"));
  const data = prefs.data;

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{t("notifPrefs.title")}</h2>
          <p className="mt-1 text-xs text-zinc-500">{t("notifPrefs.intro")}</p>
        </div>

        {!data ? (
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        ) : (
          <>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800">
              <input
                type="checkbox"
                checked={data.push_enabled}
                onChange={(e) => update.mutate({ push_enabled: e.target.checked }, { onError })}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-white">{t("notifPrefs.push")}</p>
                <p className="text-xs text-zinc-500">{t("notifPrefs.pushDesc")}</p>
              </div>
            </label>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{t("notifPrefs.byType")}</p>
              <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", !data.push_enabled && "opacity-50")}>
                {NOTIFICATION_CATEGORIES.filter((c) => !("adminOnly" in c) || isAdmin).map(({ key }) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={data[key]}
                      disabled={!data.push_enabled}
                      onChange={(e) => update.mutate({ key, enabled: e.target.checked }, { onError })}
                      className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-600 dark:bg-zinc-800"
                    />
                    <span className="text-sm text-zinc-900 dark:text-white">{t(`notifPrefs.category.${key}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{t("notifPrefs.byLogement")}</p>
              {data.logements.length === 0 ? (
                <p className="text-sm text-zinc-500">{t("notifPrefs.noLogement")}</p>
              ) : (
                <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                  {data.logements.map((l) => (
                    <li key={l.logement_id} className="flex items-center gap-3 px-3 py-2">
                      <BellOff size={16} className="shrink-0 text-blue-600" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{l.logement_name}</p>
                        <p className="text-xs text-zinc-500">{t(`notifPrefs.levelDesc.${l.level}`)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLevel.mutate({ logementId: l.logement_id, level: "all" }, { onError })}
                        className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
                      >
                        {t("notifPrefs.reset")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-xs text-zinc-500">{t("notifPrefs.byLogementHint")}</p>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
