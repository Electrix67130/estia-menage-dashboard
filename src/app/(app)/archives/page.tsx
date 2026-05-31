"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, Search, Clock, Building2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import { useMenages } from "@/hooks/useMenages";
import { logementLabel, prestataireLabel, type CalendarMenage } from "@/hooks/useCalendarMenages";
import { formatDateFr } from "@/lib/date-fr";
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

export default function ArchivesPage() {
  const list = useMenages({ limit: 500 });
  const [search, setSearch] = useState("");
  const today = todayIso();

  const archived = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = list.data?.data ?? [];
    return all
      .filter((m) => {
        const d = m.date_prevue.slice(0, 10);
        const isPast = d < today;
        const isFinal = m.status === "valide" || m.status === "annule";
        return isPast || isFinal;
      })
      .filter((m) => {
        if (!q) return true;
        return (
          (m.logement_name ?? "").toLowerCase().includes(q) ||
          (m.logement_city ?? "").toLowerCase().includes(q) ||
          (m.prestataire_first_name ?? "").toLowerCase().includes(q) ||
          (m.prestataire_last_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.date_prevue.slice(0, 10).localeCompare(a.date_prevue.slice(0, 10)));
  }, [list.data, search, today]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Archive size={24} className="text-zinc-500" />
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Archives</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {list.isLoading
              ? "Chargement…"
              : `${archived.length} ménage${archived.length > 1 ? "s" : ""} passé${archived.length > 1 ? "s" : ""} ou clôturé${archived.length > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
        />
        <Input
          placeholder="Logement, ville, prestataire…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {list.error ? (
        <Card className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-900/20 dark:text-rose-300">
          {list.error instanceof Error ? list.error.message : "Erreur de chargement"}
        </Card>
      ) : null}

      {list.isLoading ? (
        <Card>
          <p className="text-sm text-zinc-500">Chargement…</p>
        </Card>
      ) : archived.length === 0 ? (
        <EmptyState
          icon={<Archive size={32} />}
          title="Aucun ménage archivé"
          description={
            search
              ? "Aucun résultat pour cette recherche."
              : "Les ménages passés ou clôturés apparaîtront ici."
          }
        />
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {archived.map((m) => {
              const unassigned = !m.prestataire_user_id;
              return (
                <li key={m.id}>
                  <Link
                    href={`/menages/${m.id}`}
                    className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Clock size={12} className="text-zinc-400" />
                        <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-white">
                          {formatDateFr(m.date_prevue.slice(0, 10), "long")}
                          {m.horaire_prevu ? (
                            <span className="ml-2 text-xs font-normal text-zinc-500">
                              {m.horaire_prevu.slice(0, 5)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-600 dark:text-zinc-400">
                        <Building2 size={11} className="inline-block mr-1 -mt-0.5 text-zinc-400" />
                        {logementLabel(m)}
                        {m.logement_city ? <span className="text-zinc-400"> · {m.logement_city}</span> : null}
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      {unassigned ? (
                        <span className="text-xs text-zinc-400">Non assigné</span>
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
                          "inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          STATUS_PILL[m.status],
                        )}
                      >
                        {STATUS_LABEL[m.status]}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
