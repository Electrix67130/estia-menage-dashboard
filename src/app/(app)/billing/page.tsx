"use client";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, Users, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import type { User, PaginatedResponse } from "@/types/api";

// Prix indicatif par siège facturable (€/mois HT). Placeholder de l'aperçu
// « bientôt disponible » : à ajuster quand la tarification Stripe sera figée.
const PRICE_PER_SEAT = 9;

export default function BillingPage() {
  const { user: me } = useAuth();
  const { t } = useI18n();
  const isAdmin = me?.role === "admin";

  const members = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch<PaginatedResponse<User>>("/users?limit=200"),
    enabled: isAdmin,
  });

  // Sièges facturables : membres de l'organisation (les clients sont un annuaire
  // séparé, jamais des utilisateurs → non facturés).
  const billableSeats = members.data?.meta.total ?? members.data?.data.length ?? 0;
  const monthlyTotal = billableSeats * PRICE_PER_SEAT;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("billing.title")}</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{t("billing.subtitle")}</p>
      </div>

      {!isAdmin ? (
        <Card>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("billing.adminOnly")}</p>
        </Card>
      ) : (
        <>
          <Card className="flex items-start gap-3 border-blue-200 bg-blue-50 dark:border-blue-900/40 dark:bg-blue-950/30">
            <Sparkles size={20} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                {t("billing.comingSoon")}
              </p>
              <p className="mt-1 text-sm text-blue-700/80 dark:text-blue-300/70">
                {t("billing.comingSoonDesc")}
              </p>
            </div>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <Users size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {t("billing.billableSeats")}
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                {members.isLoading ? "…" : billableSeats}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t("billing.billableHint")}
              </p>
            </Card>

            <Card>
              <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                <CreditCard size={16} />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {t("billing.monthlyTotal")}
                </span>
              </div>
              <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
                {members.isLoading ? "…" : `${monthlyTotal}€`}
                <span className="ml-1 text-sm font-normal text-zinc-500">
                  {t("billing.perMonth")}
                </span>
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {t("billing.seatsUnit", { price: PRICE_PER_SEAT })}
              </p>
            </Card>
          </div>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  {t("billing.plan")}
                </p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">
                  {t("billing.planName")}
                </p>
                <p className="mt-1 max-w-xl text-sm text-zinc-500 dark:text-zinc-400">
                  {t("billing.planDesc", { price: PRICE_PER_SEAT })}
                </p>
              </div>
              <Button size="sm" disabled>
                {t("billing.manage")}
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
