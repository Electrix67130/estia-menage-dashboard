"use client";

import { useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { useI18n } from "@/contexts/I18nContext";
import {
  useDecideReschedule,
  useRescheduleRequests,
} from "@/hooks/useRescheduleRequests";
import { ApiError } from "@/lib/api";
import { formatDateFr } from "@/lib/date-fr";
import type { RescheduleStatus } from "@/types/api";

const STATUS_OPTIONS: { value: RescheduleStatus | "all"; labelKey: string }[] = [
  { value: "pending", labelKey: "reschedule.status.pending" },
  { value: "approved", labelKey: "reschedule.filter.approved" },
  { value: "rejected", labelKey: "reschedule.filter.rejected" },
  { value: "cancelled", labelKey: "reschedule.filter.cancelled" },
  { value: "all", labelKey: "reschedule.filter.all" },
];

const STATUS_BADGE: Record<RescheduleStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  cancelled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const STATUS_KEY: Record<RescheduleStatus, string> = {
  pending: "reschedule.status.pending",
  approved: "reschedule.status.approved",
  rejected: "reschedule.status.rejected",
  cancelled: "reschedule.status.cancelled",
};

export default function RescheduleRequestsPage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<RescheduleStatus | "all">("pending");
  const list = useRescheduleRequests({
    status: filter === "all" ? undefined : filter,
  });
  const decide = useDecideReschedule();

  const handleDecide = async (
    id: string,
    decision: "approved" | "rejected",
  ) => {
    const reason =
      decision === "rejected"
        ? prompt(t("reschedule.rejectReasonPrompt")) ?? undefined
        : undefined;
    try {
      await decide.mutateAsync({ id, decision, decision_reason: reason });
      toast.success(decision === "approved" ? t("reschedule.approvedToast") : t("reschedule.rejectedToast"));
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("common.error");
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CalendarClock size={24} className="text-zinc-500" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {t("reschedule.title")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("reschedule.subtitle")}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === opt.value
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            }`}
          >
            {t(opt.labelKey)}
          </button>
        ))}
      </div>

      <Card className="p-0">
        {list.isLoading ? (
          <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>
        ) : list.data && list.data.data.length > 0 ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.data.data.map((r) => (
              <li key={r.id} className="px-6 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}
                      >
                        {t(STATUS_KEY[r.status])}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {t("reschedule.requestedOn", { date: formatDateFr(r.created_at, "datetime") })}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-900 dark:text-white">
                      <span className="font-medium">{formatDateFr(r.original_date, "long")}</span>{" "}
                      → <span className="font-medium">{formatDateFr(r.proposed_date, "long")}</span>
                      {r.proposed_time ? (
                        <span className="text-zinc-500"> {t("reschedule.atTime", { time: r.proposed_time })}</span>
                      ) : null}
                    </p>
                    {r.reason ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        {t("reschedule.reason", { reason: r.reason })}
                      </p>
                    ) : null}
                    {r.decision_reason ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        {t("reschedule.decision", { reason: r.decision_reason })}
                      </p>
                    ) : null}
                  </div>
                  {r.status === "pending" ? (
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDecide(r.id, "rejected")}
                        disabled={decide.isPending}
                      >
                        <X size={14} />
                        {t("common.refuse")}
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDecide(r.id, "approved")}
                        disabled={decide.isPending}
                      >
                        <Check size={14} />
                        {t("reschedule.approve")}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-zinc-500">{t("reschedule.emptyFilter")}</p>
        )}
      </Card>
    </div>
  );
}
