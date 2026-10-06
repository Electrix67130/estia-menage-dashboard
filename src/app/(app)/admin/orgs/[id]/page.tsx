"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle, LogIn } from "lucide-react";
import BackLink from "@/components/BackLink";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import StatusBadge from "@/components/StatusBadge";
import { adminApi } from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";
import { setTokens } from "@/lib/api";
import { useConfirm } from "@/contexts/DialogContext";
import { useI18n } from "@/contexts/I18nContext";
import type { MenageStatus, UserRole } from "@/types/api";

interface OrgDetail {
  id: string;
  name: string;
  is_active: boolean;
  archive_retention_years: number;
  created_at: string;
  members: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    is_active: boolean;
    role: string;
    joined_at: string;
  }[];
  menages: {
    id: string;
    name: string;
    status: string;
    archived_at: string | null;
    created_at: string;
  }[];
}

const ROLE_KEYS: Record<UserRole, string> = {
  admin: "role.admin",
  prestataire: "role.prestataire",
};

const MENAGE_STATUSES: readonly MenageStatus[] = ["a_venir", "en_cours", "termine", "valide", "annule"];
const isMenageStatus = (s: string): s is MenageStatus =>
  (MENAGE_STATUSES as readonly string[]).includes(s);

export default function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { t, tp } = useI18n();

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "orgs", id],
    queryFn: () => adminApi.org(id) as Promise<OrgDetail>,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "orgs"] });

  const enable = useMutation({
    mutationFn: () => adminApi.enableOrg(id),
    onSuccess: () => {
      toast.success(t("admin.orgReactivated"));
      invalidate();
    },
  });
  const disable = useMutation({
    mutationFn: () => adminApi.disableOrg(id),
    onSuccess: () => {
      toast.success(t("admin.orgDeactivated"));
      invalidate();
    },
  });
  const impersonate = useMutation({
    mutationFn: () => adminApi.impersonate(id),
    onSuccess: (data) => {
      setTokens(data.access_token, "");
      toast.success(t("admin.impersonated"));
      router.replace("/dashboard");
    },
    onError: () => toast.error(t("admin.impersonateNoAdmin")),
  });

  // Rôle connu → libellé traduit ; sinon on affiche le code tel quel (donnée API).
  const roleLabel = (role: string) =>
    role in ROLE_KEYS ? t(ROLE_KEYS[role as UserRole]) : role;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink
          fallback="/admin/orgs"
          label={t("admin.backToOrgs")}
          size={14}
          className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
        />
        {isLoading ? (
          <h1 className="text-2xl font-bold text-zinc-400">{t("common.loading")}</h1>
        ) : error || !data ? (
          <h1 className="text-2xl font-bold text-rose-600">{t("admin.orgNotFound")}</h1>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{data.name}</h1>
            {!data.is_active ? <Badge variant="danger">{t("admin.orgDisabled")}</Badge> : null}
          </div>
        )}
      </div>

      {data ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => impersonate.mutate()} variant="secondary">
              <LogIn size={14} />
              {t("admin.impersonate")}
            </Button>
            {data.is_active ? (
              <Button
                variant="danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: t("admin.disableOrgTitle", { name: data.name }),
                    description: t("admin.disableOrgDescShort", { name: data.name }),
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
          </div>

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">{t("admin.details")}</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("admin.orgCreatedOnLabel")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">{formatDate(data.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("admin.archiveRetention")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">
                  {tp("admin.years", data.archive_retention_years)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("dashboard.members")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">{data.members.length}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {t("nav.menages")}
                </dt>
                <dd className="mt-0.5 text-zinc-900 dark:text-white">{data.menages.length}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-0">
            <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {t("admin.membersWithCount", { count: data.members.length })}
              </h2>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-6 py-3">
                  <Avatar firstName={m.first_name} lastName={m.last_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/users/${m.id}`}
                      className="truncate font-medium text-zinc-900 hover:underline dark:text-white"
                    >
                      {m.first_name} {m.last_name}
                    </Link>
                    <p className="truncate text-xs text-zinc-500">{m.email}</p>
                  </div>
                  <Badge variant={m.role === "admin" ? "info" : "default"}>{roleLabel(m.role)}</Badge>
                  {!m.is_active ? <Badge variant="danger">{t("admin.userDisabled")}</Badge> : null}
                </li>
              ))}
            </ul>
          </Card>

          {data.menages.length > 0 ? (
            <Card className="p-0">
              <div className="border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {t("admin.menagesWithCount", { count: data.menages.length })}
                </h2>
              </div>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.menages.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-6 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-zinc-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-zinc-500">
                        {t("admin.menageCreatedOn", { date: formatDate(c.created_at) })}
                        {c.archived_at
                          ? ` • ${t("admin.menageArchivedOn", { date: formatDate(c.archived_at) })}`
                          : ""}
                      </p>
                    </div>
                    {isMenageStatus(c.status) ? (
                      <StatusBadge status={c.status} />
                    ) : (
                      <Badge variant={c.archived_at ? "default" : "info"}>{c.status}</Badge>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
