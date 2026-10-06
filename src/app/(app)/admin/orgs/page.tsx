"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Ban, CheckCircle, LogIn } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { adminApi } from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";
import { setTokens } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/contexts/DialogContext";
import { useI18n } from "@/contexts/I18nContext";

export default function AdminOrgsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { t, tp } = useI18n();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orgs", search],
    queryFn: () => adminApi.orgs(search || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "orgs"] });

  const enable = useMutation({
    mutationFn: adminApi.enableOrg,
    onSuccess: () => {
      toast.success(t("admin.orgReactivated"));
      invalidate();
    },
  });
  const disable = useMutation({
    mutationFn: adminApi.disableOrg,
    onSuccess: () => {
      toast.success(t("admin.orgDeactivated"));
      invalidate();
    },
  });

  const impersonate = useMutation({
    mutationFn: adminApi.impersonate,
    onSuccess: (data) => {
      // On stocke le JWT temporaire (30 min) à la place de l'access_token, le refresh
      // existant continue de fonctionner avec ton compte super_admin.
      setTokens(data.access_token, "");
      toast.success(t("admin.impersonated"));
      router.replace("/dashboard");
    },
    onError: () => toast.error(t("admin.impersonateNoAdmin")),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.orgs")}</h1>
        <p className="text-sm text-zinc-500">{tp("admin.orgCount", data?.meta.total ?? 0)}</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder={t("admin.searchOrgsPlaceholder")}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card className="p-0">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>
        ) : data && data.data.length > 0 ? (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {data.data.map((o) => (
              <li key={o.id} className="flex items-center gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-zinc-900 dark:text-white">{o.name}</p>
                    {!o.is_active ? <Badge variant="danger">{t("admin.orgDisabled")}</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {tp("team.memberCount", o.member_count)} • {tp("menages.activeCount", o.menage_count)} •{" "}
                    {t("admin.orgCreatedOn", { date: formatDate(o.created_at) })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t("admin.impersonateTitle", { name: o.name }),
                      description: t("admin.impersonateDesc", { name: o.name }),
                      confirmLabel: t("admin.impersonateConfirm"),
                    });
                    if (ok) impersonate.mutate(o.id);
                  }}
                  title={t("admin.impersonate")}
                >
                  <LogIn size={14} />
                  {t("admin.impersonate")}
                </Button>
                {o.is_active ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("admin.disableOrgTitle", { name: o.name }),
                        description: t("admin.disableOrgDesc", { name: o.name }),
                        confirmLabel: t("admin.disable"),
                        tone: "danger",
                      });
                      if (ok) disable.mutate(o.id);
                    }}
                  >
                    <Ban size={14} />
                    {t("admin.disable")}
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => enable.mutate(o.id)}>
                    <CheckCircle size={14} />
                    {t("admin.enable")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-zinc-500">{t("admin.noOrgs")}</p>
        )}
      </Card>
    </div>
  );
}
