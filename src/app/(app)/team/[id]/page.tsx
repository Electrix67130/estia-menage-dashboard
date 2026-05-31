"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  Mail,
  Phone,
  Calendar,
  Trash2,
  Building2,
  CheckCircle2,
  Wallet,
  Clock,
  CalendarClock,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import CopyButton from "@/components/ui/CopyButton";
import { apiFetch, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { formatDateFr, formatCurrencyFr } from "@/lib/date-fr";
import { roleBadgeClass } from "@/lib/role-style";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useConfirm } from "@/contexts/DialogContext";
import { useMenages } from "@/hooks/useMenages";
import { useRescheduleRequests, useDecideReschedule } from "@/hooks/useRescheduleRequests";
import type { User, UserRole } from "@/types/api";

const ROLES: UserRole[] = ["admin", "prestataire"];

const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  admin: "role.admin",
  prestataire: "role.prestataire",
};

export default function TeamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const { t } = useI18n();
  const confirm = useConfirm();
  const isAdmin = me?.role === "admin";
  const isMe = me?.id === id;
  const roleLabel = (r: UserRole) => t(ROLE_LABEL_KEYS[r]);

  const { data: user, isLoading, error } = useQuery({
    queryKey: ["users", id],
    queryFn: () => apiFetch<User>(`/users/${id}`),
  });

  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

  useEffect(() => {
    if (user) setSelectedRole(user.role);
  }, [user]);

  const updateRole = useMutation({
    mutationFn: (role: UserRole) => apiFetch(`/users/${id}`, { method: "PATCH", body: { role } }),
    onSuccess: () => {
      toast.success(t("team.roleUpdated"));
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["users", id] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
  });

  const removeUser = useMutation({
    mutationFn: () => apiFetch(`/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("team.deleted"));
      qc.invalidateQueries({ queryKey: ["users"] });
      router.replace("/team");
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/team"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          {t("team.back")}
        </Link>
        <Card>
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        </Card>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex flex-col gap-6">
        <Link
          href="/team"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        >
          <ArrowLeft size={14} />
          {t("team.back")}
        </Link>
        <Card>
          <p className="text-sm text-rose-600">{t("team.notFound")}</p>
        </Card>
      </div>
    );
  }

  const canChangeRole = isAdmin && !isMe;
  const canDelete = isAdmin && !isMe;
  const roleChanged = selectedRole !== null && selectedRole !== user.role;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/team"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
      >
        <ArrowLeft size={14} />
        {t("team.back")}
      </Link>

      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          firstName={user.first_name}
          lastName={user.last_name}
          src={user.avatar_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {user.first_name} {user.last_name}
              {isMe ? (
                <span className="ml-2 text-base font-normal text-zinc-500">
                  ({t("common.you").toLowerCase()})
                </span>
              ) : null}
            </h1>
            <span className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</span>
            {user.is_active === false ? (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                {t("team.inactive")}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-zinc-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
              {t("team.info")}
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Detail
                icon={<Mail size={14} />}
                label={t("auth.email")}
                value={user.email}
                href={`mailto:${user.email}`}
                copyLabel={t("auth.email")}
              />
              <Detail
                icon={<Phone size={14} />}
                label={t("team.phone")}
                value={user.phone || ""}
                href={user.phone ? `tel:${user.phone}` : undefined}
                copyLabel={t("team.phone")}
              />
              <Detail
                icon={<Building2 size={14} />}
                label={t("team.company")}
                value={user.company_name || ""}
                copyLabel={t("team.company")}
              />
              <Detail
                icon={<Calendar size={14} />}
                label={t("team.joinedOn")}
                value={formatDate(user.created_at)}
              />
            </dl>
          </Card>

          {canChangeRole ? (
            <Card>
              <h2 className="mb-1 text-sm font-semibold text-zinc-900 dark:text-white">
                {t("team.changeRole")}
              </h2>
              <p className="mb-4 text-xs text-zinc-500">{t("team.changeRoleHint")}</p>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r) => {
                  const active = selectedRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={
                        active
                          ? roleBadgeClass(r) + " ring-2 ring-offset-1 dark:ring-offset-zinc-950"
                          : "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 hover:bg-zinc-50 dark:text-zinc-400 dark:ring-zinc-700 dark:hover:bg-zinc-900"
                      }
                    >
                      {active ? <CheckCircle2 size={12} /> : null}
                      {roleLabel(r)}
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  onClick={() => selectedRole && updateRole.mutate(selectedRole)}
                  disabled={!roleChanged}
                  loading={updateRole.isPending}
                >
                  {t("common.save")}
                </Button>
                {roleChanged ? (
                  <Button variant="ghost" onClick={() => setSelectedRole(user.role)}>
                    {t("common.cancel")}
                  </Button>
                ) : null}
              </div>
            </Card>
          ) : null}

          {isAdmin ? <PrestataireActivity userId={id} /> : null}
        </div>

        {canDelete ? (
          <div className="space-y-4">
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-rose-700 dark:text-rose-300">
                {t("team.dangerZone")}
              </h2>
              <p className="mb-3 text-xs text-zinc-500">{t("team.removeHint")}</p>
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: t("team.removeMember"),
                    description: t("team.confirmDelete", {
                      name: `${user.first_name} ${user.last_name}`,
                    }),
                    confirmLabel: t("common.delete"),
                    tone: "danger",
                  });
                  if (ok) removeUser.mutate();
                }}
                loading={removeUser.isPending}
              >
                <Trash2 size={14} />
                {t("team.removeMember")}
              </Button>
            </Card>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  href,
  copyLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  copyLabel?: string;
}) {
  const empty = !value;
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 flex items-center gap-2 text-sm text-zinc-900 dark:text-white">
        {empty ? (
          <span className="text-zinc-400">—</span>
        ) : href ? (
          <a href={href} className="hover:underline">
            {value}
          </a>
        ) : (
          <span>{value}</span>
        )}
        {!empty && copyLabel ? <CopyButton value={value} label={copyLabel} /> : null}
      </dd>
    </div>
  );
}

interface EarningsResponse {
  total: number;
  currency: string;
  count: number;
  from: string | null;
  to: string | null;
  items: Array<{
    id: string;
    date_prevue: string;
    logement_id: string;
    status: string;
    provider_price: string | number | null;
    laundry_provider_price: string | number | null;
    laundry_included: boolean;
    subtotal: number;
    validated_at: string | null;
  }>;
}

function PrestataireActivity({ userId }: { userId: string }) {
  const earnings = useQuery({
    queryKey: ["user-earnings", userId],
    queryFn: () => apiFetch<EarningsResponse>(`/users/${userId}/earnings`),
  });
  const menages = useMenages({ prestataire_user_id: userId, limit: 50 });

  const upcoming = (menages.data?.data ?? [])
    .filter((m) => m.status === "a_venir" || m.status === "en_cours")
    .sort((a, b) => a.date_prevue.slice(0, 10).localeCompare(b.date_prevue.slice(0, 10)));

  const past = (menages.data?.data ?? [])
    .filter((m) => m.status !== "a_venir" && m.status !== "en_cours")
    .sort((a, b) => b.date_prevue.slice(0, 10).localeCompare(a.date_prevue.slice(0, 10)));

  return (
    <>
      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <Wallet size={14} className="text-blue-600" />
          Gains du prestataire
        </h2>
        {earnings.isLoading ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : earnings.error ? (
          <p className="text-sm text-rose-600">
            {earnings.error instanceof Error ? earnings.error.message : "Erreur"}
          </p>
        ) : earnings.data ? (
          <>
            <div className="mb-4 flex items-baseline gap-3">
              <p className="text-3xl font-bold text-zinc-900 dark:text-white">
                {formatCurrencyFr(earnings.data.total, earnings.data.currency)}
              </p>
              <p className="text-sm text-zinc-500">
                sur {earnings.data.count} ménage{earnings.data.count > 1 ? "s" : ""} terminé{earnings.data.count > 1 ? "s" : ""}
              </p>
            </div>
            {earnings.data.items.length > 0 ? (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {earnings.data.items.slice(0, 8).map((it) => (
                  <li key={it.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/menages/${it.id}`} className="flex items-center gap-2 hover:text-blue-600">
                      <Clock size={12} className="text-zinc-400" />
                      <span className="capitalize">
                        {formatDateFr(it.date_prevue.slice(0, 10), "long")}
                      </span>
                      {it.validated_at ? (
                        <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                          Validé
                        </span>
                      ) : null}
                    </Link>
                    <span className="font-medium text-zinc-900 dark:text-white">
                      {formatCurrencyFr(it.subtotal, earnings.data.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {earnings.data.items.length > 8 ? (
              <p className="mt-2 text-xs text-zinc-500">
                + {earnings.data.items.length - 8} autres ménages
              </p>
            ) : null}
          </>
        ) : null}
      </Card>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <CalendarClock size={14} className="text-blue-600" />
          Calendrier — Ménages à venir
        </h2>
        {menages.isLoading ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : upcoming.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun ménage à venir.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {upcoming.slice(0, 10).map((m) => (
              <li key={m.id}>
                <Link href={`/menages/${m.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-600">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-zinc-400" />
                    <span className="capitalize">
                      {formatDateFr(m.date_prevue.slice(0, 10), "long")}
                      {m.horaire_prevu ? (
                        <span className="ml-1 text-zinc-400">· {m.horaire_prevu.slice(0, 5)}</span>
                      ) : null}
                    </span>
                  </div>
                  <span className="truncate text-xs text-zinc-500">
                    {m.logement_name || m.logement_city || "—"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <RescheduleSection userId={userId} />

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
          <Building2 size={14} className="text-blue-600" />
          Historique des ménages
        </h2>
        {menages.isLoading ? (
          <p className="text-sm text-zinc-500">Chargement…</p>
        ) : past.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucun ménage terminé.</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {past.slice(0, 10).map((m) => (
              <li key={m.id}>
                <Link href={`/menages/${m.id}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-blue-600">
                  <div className="flex items-center gap-2">
                    <Clock size={12} className="text-zinc-400" />
                    <span className="capitalize">{formatDateFr(m.date_prevue.slice(0, 10), "long")}</span>
                  </div>
                  <span className="text-xs uppercase tracking-wider text-zinc-500">{m.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

const RESCHEDULE_STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  rejected: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const RESCHEDULE_STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvée",
  rejected: "Refusée",
};

function RescheduleSection({ userId }: { userId: string }) {
  const list = useRescheduleRequests({ requested_by: userId });
  const decide = useDecideReschedule();

  const handleDecide = async (
    id: string,
    decision: "approved" | "rejected",
    applyToMenage: boolean,
  ) => {
    try {
      await decide.mutateAsync({
        id,
        decision,
        apply_to_menage: applyToMenage,
      });
      toast.success(decision === "approved" ? "Demande approuvée" : "Demande refusée");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Erreur");
    }
  };

  const items = list.data?.data ?? [];
  const pending = items.filter((r) => r.status === "pending");
  const others = items.filter((r) => r.status !== "pending");

  return (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <CalendarClock size={14} className="text-blue-600" />
        Demandes de changement de date
        {pending.length > 0 ? (
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            {pending.length} en attente
          </span>
        ) : null}
      </h2>

      {list.isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-zinc-500">Aucune demande.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {[...pending, ...others].slice(0, 10).map((r) => (
            <li key={r.id} className="flex flex-col gap-2 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-zinc-900 dark:text-white">
                    <Link href={`/menages/${r.menage_id}`} className="hover:text-blue-600">
                      Ménage du {formatDateFr(r.original_date.slice(0, 10), "long")}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    → demande de déplacement au{" "}
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {formatDateFr(r.proposed_date.slice(0, 10), "long")}
                      {r.proposed_time ? ` à ${r.proposed_time.slice(0, 5)}` : ""}
                    </span>
                  </p>
                  {r.reason ? (
                    <p className="mt-1 text-xs italic text-zinc-600 dark:text-zinc-400">
                      « {r.reason} »
                    </p>
                  ) : null}
                </div>
                <span
                  className={
                    "inline-flex flex-shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider " +
                    (RESCHEDULE_STATUS_PILL[r.status] ?? "bg-zinc-200 text-zinc-700")
                  }
                >
                  {RESCHEDULE_STATUS_LABEL[r.status] ?? r.status}
                </span>
              </div>
              {r.status === "pending" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleDecide(r.id, "approved", true)}
                    disabled={decide.isPending}
                  >
                    <CheckCircle2 size={12} />
                    Approuver
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleDecide(r.id, "approved", false)}
                    disabled={decide.isPending}
                  >
                    Approuver sans appliquer
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDecide(r.id, "rejected", false)}
                    disabled={decide.isPending}
                  >
                    Refuser
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

