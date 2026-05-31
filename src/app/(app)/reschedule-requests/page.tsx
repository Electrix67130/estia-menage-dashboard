"use client";

import { useState } from "react";
import { CalendarClock, Check, X } from "lucide-react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  useDecideReschedule,
  useRescheduleRequests,
} from "@/hooks/useRescheduleRequests";
import { ApiError } from "@/lib/api";
import { formatDateFr } from "@/lib/date-fr";
import type { RescheduleStatus } from "@/types/api";

const STATUS_OPTIONS: { value: RescheduleStatus | "all"; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "approved", label: "Approuvées" },
  { value: "rejected", label: "Refusées" },
  { value: "cancelled", label: "Annulées" },
  { value: "all", label: "Toutes" },
];

const STATUS_BADGE: Record<RescheduleStatus, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  cancelled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

const STATUS_LABEL: Record<RescheduleStatus, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
  cancelled: "Annulée",
};

export default function RescheduleRequestsPage() {
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
        ? prompt("Motif du refus (optionnel) :") ?? undefined
        : undefined;
    try {
      await decide.mutateAsync({ id, decision, decision_reason: reason });
      toast.success(decision === "approved" ? "Demande approuvée" : "Demande refusée");
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Erreur";
      toast.error(msg);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <CalendarClock size={24} className="text-zinc-500" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Demandes de changement de date
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Les prestataires peuvent demander à reporter un ménage. Approuve ou refuse.
          </p>
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
            {opt.label}
          </button>
        ))}
      </div>

      <Card className="p-0">
        {list.isLoading ? (
          <p className="p-6 text-sm text-zinc-500">Chargement…</p>
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
                        {STATUS_LABEL[r.status]}
                      </span>
                      <span className="text-xs text-zinc-500">
                        Demandée le {formatDateFr(r.created_at, "datetime")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-900 dark:text-white">
                      <span className="font-medium">{formatDateFr(r.original_date, "long")}</span>{" "}
                      → <span className="font-medium">{formatDateFr(r.proposed_date, "long")}</span>
                      {r.proposed_time ? (
                        <span className="text-zinc-500"> à {r.proposed_time}</span>
                      ) : null}
                    </p>
                    {r.reason ? (
                      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                        Motif : {r.reason}
                      </p>
                    ) : null}
                    {r.decision_reason ? (
                      <p className="mt-1 text-xs text-zinc-500">
                        Décision : {r.decision_reason}
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
                        Refuser
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleDecide(r.id, "approved")}
                        disabled={decide.isPending}
                      >
                        <Check size={14} />
                        Approuver
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-zinc-500">Aucune demande pour ce filtre.</p>
        )}
      </Card>
    </div>
  );
}
