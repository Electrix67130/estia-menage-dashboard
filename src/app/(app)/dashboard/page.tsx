"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  UserX,
  CalendarClock,
  Wallet,
  Plus,
  Clock,
  MapPin,
  LogIn,
  LogOut,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useMenages } from "@/hooks/useMenages";
import { useRescheduleRequests } from "@/hooks/useRescheduleRequests";
import { logementLabel, prestataireLabel, type CalendarMenage } from "@/hooks/useCalendarMenages";
import { formatDateFr, formatCurrencyFr } from "@/lib/date-fr";
import { prestationTypeLabel, prestationTypePill } from "@/lib/prestation";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<CalendarMenage["status"], string> = {
  a_venir: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  en_cours: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  termine: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  valide: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  annule: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_LABEL: Record<CalendarMenage["status"], string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  termine: "Terminé",
  valide: "Validé",
  annule: "Annulé",
};

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfMonthIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === "admin";

  const allMenages = useMenages({ limit: 200 });
  const unassigned = useMenages({ unassigned: true, limit: 1 });
  const reschedules = useRescheduleRequests({ status: "pending" });

  const today = todayIso();
  const monthStart = startOfMonthIso();

  const stats = useMemo(() => {
    const items = allMenages.data?.data ?? [];
    const upcoming = items.filter(
      (m) => m.date_prevue.slice(0, 10) >= today && (m.status === "a_venir" || m.status === "en_cours"),
    );
    const validatedThisMonth = items.filter(
      (m) =>
        m.status === "valide" &&
        m.date_prevue.slice(0, 10) >= monthStart &&
        m.date_prevue.slice(0, 10) <= today,
    );
    // Estimation CA : somme des provider_price (admin voit aussi le client_price si exposé).
    // Le CalendarMenage type n'a pas les prix, on n'estime que le nombre.
    return {
      // « Ménages à venir » = uniquement les prestations de nettoyage, pour ne pas
      // doublonner avec les cartes check-in / check-out.
      upcomingMenageCount: upcoming.filter((m) => (m.prestation_type ?? "menage") === "menage").length,
      upcomingCheckInCount: upcoming.filter((m) => m.prestation_type === "check_in").length,
      upcomingCheckOutCount: upcoming.filter((m) => m.prestation_type === "check_out").length,
      validatedCount: validatedThisMonth.length,
    };
  }, [allMenages.data, today, monthStart]);

  const nextMenages = useMemo(() => {
    const items = allMenages.data?.data ?? [];
    return items
      .filter((m) => m.date_prevue.slice(0, 10) >= today && m.status !== "annule")
      .sort((a, b) => a.date_prevue.slice(0, 10).localeCompare(b.date_prevue.slice(0, 10)))
      .slice(0, 6);
  }, [allMenages.data, today]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {t("dashboard.greeting", { name: user?.first_name ?? "" })}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("dashboard.subtitle")}</p>
        </div>
        {isAdmin ? (
          <Link href="/menages/new">
            <Button>
              <Plus size={16} />
              Nouveau ménage
            </Button>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard
          icon={<CalendarClock size={20} />}
          label="Ménages à venir"
          value={stats.upcomingMenageCount}
          href="/menages"
        />
        <StatCard
          icon={<LogIn size={20} />}
          label="Check-in à venir"
          value={stats.upcomingCheckInCount}
          href="/check-ins"
        />
        <StatCard
          icon={<LogOut size={20} />}
          label="Check-out à venir"
          value={stats.upcomingCheckOutCount}
          href="/check-outs"
        />
        <StatCard
          icon={<UserX size={20} />}
          label="Non assignés"
          value={unassigned.data?.meta.total ?? 0}
          href="/menages"
          highlight={(unassigned.data?.meta.total ?? 0) > 0}
        />
        <StatCard
          icon={<Clock size={20} />}
          label="Reschedule en attente"
          value={
            (reschedules.data?.data ?? []).filter((r) => r.status === "pending").length
          }
          href="/reschedule-requests"
          highlight={
            (reschedules.data?.data ?? []).filter((r) => r.status === "pending").length > 0
          }
        />
        <StatCard
          icon={<Wallet size={20} />}
          label="Validés ce mois"
          value={stats.validatedCount}
          href="/archives"
        />
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">
            Prochaines prestations
          </h2>
          <Link
            href="/menages"
            className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Tout voir
          </Link>
        </div>

        {allMenages.isLoading ? (
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        ) : nextMenages.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Aucun ménage planifié. Crée le premier pour commencer.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {nextMenages.map((m) => {
              const unassignedM = !m.prestataire_user_id;
              return (
                <li key={m.id}>
                  <Link
                    href={`/menages/${m.id}`}
                    className="flex items-center justify-between gap-3 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-white">
                        {formatDateFr(m.date_prevue.slice(0, 10), "weekday")}
                        {m.horaire_prevu ? (
                          <span className="ml-2 text-xs font-normal text-zinc-500">
                            {m.horaire_prevu.slice(0, 5)}
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        <MapPin size={11} className="inline-block -mt-0.5 mr-1 text-zinc-400" />
                        {logementLabel(m)}
                        {m.logement_city ? (
                          <span className="text-zinc-400"> · {m.logement_city}</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      {unassignedM ? (
                        <span className="hidden text-xs text-amber-600 sm:inline">
                          Non assigné
                        </span>
                      ) : (
                        <div className="hidden items-center gap-1.5 sm:inline-flex">
                          <Avatar
                            firstName={m.prestataire_first_name ?? undefined}
                            lastName={m.prestataire_last_name ?? undefined}
                            src={m.prestataire_avatar_url ?? undefined}
                            size="sm"
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            {prestataireLabel(m)}
                          </span>
                        </div>
                      )}
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          prestationTypePill(m.prestation_type),
                        )}
                      >
                        {prestationTypeLabel(m.prestation_type)}
                      </span>
                      <span
                        className={
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                          STATUS_PILL[m.status]
                        }
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {isAdmin ? (
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold text-zinc-900 dark:text-white">
            Raccourcis admin
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ShortcutLink href="/logements/new" icon={<Plus size={16} />} label="Nouveau logement" />
            <ShortcutLink href="/clients" icon={<Users size={16} />} label="Gérer les clients" />
            <ShortcutLink href="/team" icon={<Users size={16} />} label="Équipe" />
            <ShortcutLink href="/map" icon={<MapPin size={16} />} label="Carte" />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  href,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={
          "h-full transition-colors hover:border-blue-500/50 " +
          (highlight
            ? "border-amber-300 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-900/10"
            : "")
        }
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">
              {value}
            </p>
          </div>
          <div className={highlight ? "text-amber-600" : "text-blue-600 dark:text-blue-400"}>
            {icon}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ShortcutLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:border-blue-500/50 hover:bg-blue-50/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-blue-500/50 dark:hover:bg-blue-900/10"
    >
      <span className="text-blue-600 dark:text-blue-400">{icon}</span>
      <span className="truncate">{label}</span>
    </Link>
  );
}

// Utilisé pour le typage du label currency (non utilisé ici mais évite warning lint)
void formatCurrencyFr;
