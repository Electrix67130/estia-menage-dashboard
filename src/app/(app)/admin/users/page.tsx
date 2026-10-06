"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Ban, CheckCircle, KeyRound, LogOut, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { adminApi } from "@/lib/admin-api";
import { formatDate } from "@/lib/utils";
import { useConfirm, useAlert } from "@/contexts/DialogContext";
import { useI18n } from "@/contexts/I18nContext";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const showAlert = useAlert();
  const { t, tp } = useI18n();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search],
    queryFn: () => adminApi.users(search || undefined),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "users"] });

  const enable = useMutation({
    mutationFn: adminApi.enableUser,
    onSuccess: () => {
      toast.success(t("admin.userReactivated"));
      invalidate();
    },
  });
  const disable = useMutation({
    mutationFn: adminApi.disableUser,
    onSuccess: () => {
      toast.success(t("admin.userDeactivated"));
      invalidate();
    },
  });
  const kick = useMutation({
    mutationFn: adminApi.kickSessions,
    onSuccess: (data) => {
      toast.success(tp("admin.sessionsKilled", data.sessions_killed));
    },
  });
  const reset = useMutation({
    mutationFn: adminApi.forceReset,
    onSuccess: (data) => {
      showAlert({
        title: t("admin.tempPasswordTitle"),
        description: t("admin.tempPasswordDesc", { password: data.temporary_password }),
        tone: "info",
      });
    },
  });
  const remove = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      toast.success(t("admin.userDeleted"));
      invalidate();
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">{t("admin.users")}</h1>
        <p className="text-sm text-zinc-500">{tp("admin.userCount", data?.meta.total ?? 0)}</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input
          placeholder={t("admin.searchUsersPlaceholder")}
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
            {data.data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-zinc-900 dark:text-white">
                      {u.first_name} {u.last_name}
                    </p>
                    {!u.is_active ? <Badge variant="danger">{t("admin.userDisabled")}</Badge> : null}
                    {u.is_super_admin ? <Badge variant="info">{t("admin.section")}</Badge> : null}
                  </div>
                  <p className="truncate text-sm text-zinc-500">
                    {u.email}
                    {u.phone ? ` · ${u.phone}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {t("admin.joinedOn", { date: formatDate(u.created_at) })}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t("admin.resetPasswordTitle"),
                      description: t("admin.resetPasswordDesc", { email: u.email }),
                      confirmLabel: t("common.reset"),
                    });
                    if (ok) reset.mutate(u.id);
                  }}
                  title={t("admin.resetPasswordTitle")}
                >
                  <KeyRound size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t("admin.kickSessionsTitle"),
                      description: t("admin.kickSessionsDesc", { email: u.email }),
                      confirmLabel: t("admin.kickSessionsConfirm"),
                      tone: "danger",
                    });
                    if (ok) kick.mutate(u.id);
                  }}
                  title={t("admin.kickSessionsTitle")}
                >
                  <LogOut size={14} />
                </Button>
                {u.is_active ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={async () => {
                      const ok = await confirm({
                        title: t("admin.disable"),
                        description: t("admin.disableUserDesc", { email: u.email }),
                        confirmLabel: t("admin.disable"),
                        tone: "danger",
                      });
                      if (ok) disable.mutate(u.id);
                    }}
                    title={t("admin.disable")}
                  >
                    <Ban size={14} />
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => enable.mutate(u.id)} title={t("admin.enable")}>
                    <CheckCircle size={14} />
                  </Button>
                )}
                <Button
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    const ok = await confirm({
                      title: t("admin.deleteUserTitle"),
                      description: t("admin.deleteUserDesc", { email: u.email }),
                      confirmLabel: t("common.delete"),
                      tone: "danger",
                    });
                    if (ok) remove.mutate(u.id);
                  }}
                  title={t("common.delete")}
                >
                  <Trash2 size={14} />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-zinc-500">{t("admin.noUsers")}</p>
        )}
      </Card>
    </div>
  );
}
