"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Ban, CheckCircle, KeyRound, LogOut, Trash2 } from "lucide-react";
import BackLink from "@/components/BackLink";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { adminApi } from "@/lib/admin-api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useConfirm, useAlert } from "@/contexts/DialogContext";
import { useI18n } from "@/contexts/I18nContext";
import type { UserRole } from "@/types/api";

interface UserDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  created_at: string;
  updated_at: string;
  active_sessions: number;
  memberships: {
    organization_id: string;
    organization_name: string;
    is_active: boolean;
    role: string;
  }[];
}

const ROLE_KEYS: Record<UserRole, string> = {
  admin: "role.admin",
  prestataire: "role.prestataire",
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const router = useRouter();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const { t, tp } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users", id],
    queryFn: () => adminApi.user(id) as Promise<UserDetail>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const enable = useMutation({
    mutationFn: () => adminApi.enableUser(id),
    onSuccess: () => {
      toast.success(t("admin.userReactivated"));
      invalidate();
    },
  });
  const disable = useMutation({
    mutationFn: () => adminApi.disableUser(id),
    onSuccess: () => {
      toast.success(t("admin.userDeactivated"));
      invalidate();
    },
  });
  const kick = useMutation({
    mutationFn: () => adminApi.kickSessions(id),
    onSuccess: (data) => {
      toast.success(tp("admin.sessionsKilled", data.sessions_killed));
      invalidate();
    },
  });
  const reset = useMutation({
    mutationFn: () => adminApi.forceReset(id),
    onSuccess: (data) => {
      showAlert({
        title: t("admin.tempPasswordTitle"),
        description: t("admin.tempPasswordDesc", { password: data.temporary_password }),
        tone: "info",
      });
    },
  });
  const remove = useMutation({
    mutationFn: () => adminApi.deleteUser(id),
    onSuccess: () => {
      toast.success(t("admin.userDeleted"));
      router.replace("/admin/users");
    },
  });

  // Rôle connu → libellé traduit ; sinon on affiche le code tel quel (donnée API).
  const roleLabel = (role: string) =>
    role in ROLE_KEYS ? t(ROLE_KEYS[role as UserRole]) : role;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink
          fallback="/admin/users"
          label={t("admin.backToUsers")}
          size={14}
          className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        />
        {isLoading ? (
          <h1 className="text-2xl font-bold text-zinc-400">{t("common.loading")}</h1>
        ) : error || !data ? (
          <h1 className="text-2xl font-bold text-rose-600">{t("admin.userNotFound")}</h1>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar firstName={data.first_name} lastName={data.last_name} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                  {data.first_name} {data.last_name}
                </h1>
                {!data.is_active ? <Badge variant="danger">{t("admin.userDisabled")}</Badge> : null}
                {data.is_super_admin ? <Badge variant="info">{t("admin.section")}</Badge> : null}
              </div>
              <p className="text-sm text-zinc-500">{data.email}</p>
            </div>
          </div>
        )}
      </div>

      {data ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: t("admin.resetPasswordTitle"),
                  description: t("admin.resetPasswordDesc", { email: data.email }),
                  confirmLabel: t("common.reset"),
                });
                if (ok) reset.mutate();
              }}
            >
              <KeyRound size={14} />
              {t("admin.resetPasswordTitle")}
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                const ok = await confirm({
                  title: t("admin.kickSessionsTitle"),
                  description: t("admin.kickSessionsDesc", { email: data.email }),
                  confirmLabel: t("admin.kickSessionsConfirm"),
                  tone: "danger",
                });
                if (ok) kick.mutate();
              }}
            >
              <LogOut size={14} />
              {t("admin.kickSessionsWithCount", { count: data.active_sessions })}
            </Button>
            {data.is_active ? (
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: t("admin.disable"),
                    description: t("admin.disableUserDesc", { email: data.email }),
                    confirmLabel: t("admin.disable"),
                    tone: "danger",
                  });
                  if (ok) disable.mutate();
                }}
              >
                <Ban size={14} />
                {t("admin.disable")}
              </Button>
            ) : (
              <Button onClick={() => enable.mutate()}>
                <CheckCircle size={14} />
                {t("admin.enable")}
              </Button>
            )}
            <Button
              variant="danger"
              onClick={async () => {
                const ok = await confirm({
                  title: t("admin.deleteUserTitle"),
                  description: t("admin.deleteUserDesc", { email: data.email }),
                  confirmLabel: t("common.delete"),
                  tone: "danger",
                });
                if (ok) remove.mutate();
              }}
            >
              <Trash2 size={14} />
              {t("common.delete")}
            </Button>
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">{t("admin.details")}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("common.email")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">{data.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("team.phone")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">{data.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("team.joinedOn")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">{formatDate(data.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("admin.lastUpdated")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">
                  {formatDateTime(data.updated_at)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-0">
            <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {t("admin.membershipsWithCount", { count: data.memberships.length })}
              </h2>
            </div>
            {data.memberships.length > 0 ? (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.memberships.map((m) => (
                  <li key={m.organization_id} className="flex items-center gap-3 px-6 py-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/orgs/${m.organization_id}`}
                        className="truncate font-medium text-zinc-900 hover:underline dark:text-white"
                      >
                        {m.organization_name}
                      </Link>
                      {!m.is_active ? (
                        <Badge variant="danger" className="ml-2">
                          {t("admin.orgDeactivated")}
                        </Badge>
                      ) : null}
                    </div>
                    <Badge variant={m.role === "admin" ? "info" : "default"}>{roleLabel(m.role)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-sm text-zinc-500">{t("admin.noOrgs")}</p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
