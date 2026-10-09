"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import Card from "@/components/ui/Card";
import ReportList from "@/components/reports/ReportList";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useAllReports, useReports, type ReportStatus } from "@/hooks/useReports";

const STATUSES: ReportStatus[] = ["pending", "resolved", "dismissed"];

/**
 * Écran de modération des contenus signalés. `org` : les signalements de son
 * organisation (admin) ; `console` : toutes les organisations (super admin),
 * avec un filtre sur ceux qui visent un admin.
 */
export default function ReportsScreen({ mode }: { mode: "org" | "console" }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const [status, setStatus] = useState<ReportStatus | "">("pending");
  const [escalatedOnly, setEscalatedOnly] = useState(false);
  const isConsole = mode === "console";
  const allowed = isConsole || user?.role === "admin";

  const org = useReports({ status }, allowed && !isConsole);
  const all = useAllReports({ status, escalated: escalatedOnly }, allowed && isConsole);
  const query = isConsole ? all : org;
  const pending = query.data?.counts.pending ?? 0;

  if (!allowed) {
    return (
      <Card className="flex flex-col items-center gap-3 py-16 text-center">
        <Lock size={32} className="text-zinc-400" />
        <p className="text-sm text-zinc-500">{t("reports.adminOnly")}</p>
      </Card>
    );
  }

  const tab = (value: ReportStatus | "", label: string) => (
    <button
      key={value || "all"}
      type="button"
      onClick={() => setStatus(value)}
      aria-pressed={status === value}
      className={cn(
        "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
        status === value
          ? "bg-blue-600 text-white"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
      )}
    >
      {label}
      {value === "pending" && pending > 0 ? <span className="ml-1.5 opacity-70">{pending}</span> : null}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          {isConsole ? t("reports.consoleTitle") : t("reports.title")}
        </h1>
        <p className="text-sm text-zinc-500">{isConsole ? t("reports.consoleSubtitle") : t("reports.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => tab(s, t(`reports.status.${s}`)))}
        {tab("", t("reports.all"))}
        {isConsole ? (
          <label className="ml-auto flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={escalatedOnly}
              onChange={(e) => setEscalatedOnly(e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            {t("reports.escalatedOnly")}
          </label>
        ) : null}
      </div>

      <ReportList reports={query.data?.data ?? []} isLoading={query.isLoading} console={isConsole} />
    </div>
  );
}
