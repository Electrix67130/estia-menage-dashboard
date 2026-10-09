"use client";

import { toast } from "sonner";
import { Ban } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import { ApiError } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { useBlocks, useUnblockUser } from "@/hooks/useBlocks";

/**
 * Les personnes qu'on a bloquées (reprise de Buildr) : leurs messages et leurs
 * photos nous sont masqués. On les débloque d'ici.
 */
export default function BlockedUsers() {
  const { t } = useI18n();
  const blocks = useBlocks();
  const unblock = useUnblockUser();
  const list = blocks.data ?? [];

  return (
    <Card>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Ban size={16} className="text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{t("block.section")}</h2>
        </div>
        <p className="text-sm text-zinc-500">{t("block.hint")}</p>
        {blocks.isLoading ? (
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        ) : list.length === 0 ? (
          <p className="text-sm text-zinc-500">{t("block.empty")}</p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {list.map((b) => (
              <li key={b.user_id} className="flex items-center gap-3 py-2">
                <Avatar firstName={b.first_name} lastName={b.last_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                    {b.first_name} {b.last_name}
                  </p>
                  <p className="text-xs text-zinc-500">{t("block.since", { date: formatDate(b.created_at) })}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={unblock.isPending && unblock.variables === b.user_id}
                  onClick={() =>
                    unblock.mutate(b.user_id, {
                      onSuccess: () => toast.success(t("block.unblocked", { name: `${b.first_name} ${b.last_name}` })),
                      onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
                    })
                  }
                >
                  {t("block.unblock")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
