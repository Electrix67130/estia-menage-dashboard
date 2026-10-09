"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Ban,
  Check,
  ExternalLink,
  Flag,
  Image as ImageIcon,
  MessageSquare,
  ShieldAlert,
  Trash2,
  User,
  X,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import EmptyState from "@/components/ui/EmptyState";
import { apiFetch, ApiError } from "@/lib/api";
import { adminApi } from "@/lib/admin-api";
import { formatDate, formatDateTime } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { useConfirm } from "@/contexts/DialogContext";
import type { Report } from "@/hooks/useReports";

const TARGET_ICON = { comment: MessageSquare, photo: ImageIcon, user: User } as const;

/** Où supprimer le contenu visé ; un membre n'a pas de « contenu » à supprimer. */
export function contentDeletePath(r: Pick<Report, "target_type" | "target_id">): string | null {
  if (r.target_type === "comment") return `/comments/${r.target_id}`;
  if (r.target_type === "photo") return `/photos/${r.target_id}`;
  return null;
}

/**
 * Liste de modération des signalements (reprise de Buildr). Côté organisation,
 * l'admin peut supprimer le contenu et désactiver le compte visé ; dans la
 * console super admin (`console`), seule la désactivation passe par la route
 * support — le contenu se traite dans l'organisation.
 */
export default function ReportList({
  reports,
  isLoading,
  console: isConsole = false,
}: {
  reports: Report[];
  isLoading?: boolean;
  console?: boolean;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [resolving, setResolving] = useState<Report | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["reports"] });
  const onError = (err: unknown) => toast.error(err instanceof ApiError ? err.message : t("common.error"));

  const resolve = useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: "resolved" | "dismissed"; note?: string }) => {
      setBusyId(id);
      return apiFetch(`/reports/${id}`, { method: "PATCH", body: { status, resolution_note: note || undefined } });
    },
    onSettled: () => setBusyId(null),
    onSuccess: (_d, v) => {
      toast.success(v.status === "resolved" ? t("reports.resolvedToast") : t("reports.dismissedToast"));
      setResolving(null);
      setNote("");
      invalidate();
    },
    onError,
  });

  const deleteContent = useMutation({
    mutationFn: (r: Report) => apiFetch(contentDeletePath(r)!, { method: "DELETE" }),
    onSuccess: () => {
      toast.success(t("reports.contentDeleted"));
      invalidate();
      qc.invalidateQueries({ queryKey: ["menage-comments"] });
      qc.invalidateQueries({ queryKey: ["menage-photos"] });
    },
    onError,
  });

  // Désactiver plutôt que supprimer : l'historique des prestations reste lisible.
  const deactivate = useMutation({
    mutationFn: (userId: string) =>
      isConsole
        ? adminApi.disableUser(userId)
        : apiFetch(`/users/${userId}`, { method: "PATCH", body: { is_active: false } }),
    onSuccess: () => {
      toast.success(t("reports.accountDeactivated"));
      invalidate();
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError,
  });

  if (isLoading) return <p className="text-sm text-zinc-500">{t("common.loading")}</p>;
  if (reports.length === 0) return <EmptyState title={t("reports.empty")} description={t("reports.emptyDesc")} />;

  return (
    <>
      <div className="flex flex-col gap-3">
        {reports.map((r) => {
          const Icon = TARGET_ICON[r.target_type];
          const pending = r.status === "pending";
          const targetName = r.target_first_name
            ? `${r.target_first_name} ${r.target_last_name ?? ""}`.trim()
            : t("reports.unknownUser");
          const where = r.logement_name
            ? `${r.logement_name}${r.menage_date ? ` · ${formatDate(r.menage_date)}` : ""}`
            : null;
          return (
            <Card key={r.id} className={pending ? "border-rose-200 dark:border-rose-900/50" : ""}>
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="danger">{t(`report.reason.${r.reason}`)}</Badge>
                    <Badge variant="default">{t(`reports.target.${r.target_type}`)}</Badge>
                    {r.escalated ? (
                      <Badge variant="warning">
                        <ShieldAlert size={12} className="mr-1 inline" />
                        {t("reports.escalated")}
                      </Badge>
                    ) : null}
                    {!pending ? (
                      <Badge variant={r.status === "resolved" ? "success" : "default"}>
                        {t(`reports.status.${r.status}`)}
                      </Badge>
                    ) : null}
                    <span className="text-xs text-zinc-500">{formatDateTime(r.created_at)}</span>
                  </div>

                  <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                    {t("reports.reportedBy", { name: `${r.reporter_first_name} ${r.reporter_last_name}` })}
                    {" · "}
                    {t("reports.about", { name: targetName })}
                    {where && r.menage_id ? (
                      <>
                        {" · "}
                        <Link
                          href={`/menages/${r.menage_id}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {where}
                        </Link>
                      </>
                    ) : null}
                    {isConsole ? <span className="text-zinc-500"> · {r.organization_name}</span> : null}
                  </p>

                  {r.target_excerpt ? (
                    <blockquote className="mt-2 rounded-md border-l-2 border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      <span className="line-clamp-3 whitespace-pre-wrap">{r.target_excerpt}</span>
                    </blockquote>
                  ) : null}
                  {!r.target_exists && r.target_type !== "user" ? (
                    <p className="mt-1 text-xs italic text-zinc-500">{t("reports.targetGone")}</p>
                  ) : null}
                  {r.comment ? (
                    <p className="mt-2 text-sm italic text-zinc-600 dark:text-zinc-400">« {r.comment} »</p>
                  ) : null}
                  {r.resolution_note ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      {t("reports.note")} : {r.resolution_note}
                    </p>
                  ) : null}
                </div>
              </div>

              {pending ? (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                  {r.menage_id ? (
                    <Link href={`/menages/${r.menage_id}`}>
                      <Button variant="ghost" size="sm">
                        <ExternalLink size={14} />
                        {t("reports.openPrestation")}
                      </Button>
                    </Link>
                  ) : null}
                  {!isConsole && contentDeletePath(r) && r.target_exists ? (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deleteContent.isPending && deleteContent.variables?.id === r.id}
                      onClick={async () => {
                        const ok = await confirm({
                          title: t("reports.deleteContent"),
                          description: t("reports.deleteContentConfirm"),
                          confirmLabel: t("common.delete"),
                          tone: "danger",
                        });
                        if (ok) deleteContent.mutate(r);
                      }}
                    >
                      <Trash2 size={14} />
                      {t("reports.deleteContent")}
                    </Button>
                  ) : null}
                  {r.target_user_id ? (
                    <Button
                      variant="danger"
                      size="sm"
                      loading={deactivate.isPending && deactivate.variables === r.target_user_id}
                      onClick={async () => {
                        const ok = await confirm({
                          title: t("reports.deactivateAccount"),
                          description: t("reports.deactivateConfirm", { name: targetName }),
                          confirmLabel: t("reports.deactivateAccount"),
                          tone: "danger",
                        });
                        if (ok) deactivate.mutate(r.target_user_id!);
                      }}
                    >
                      <Ban size={14} />
                      {t("reports.deactivateAccount")}
                    </Button>
                  ) : null}
                  <span className="flex-1" />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => resolve.mutate({ id: r.id, status: "dismissed" })}
                    loading={busyId === r.id && resolve.variables?.status === "dismissed"}
                  >
                    <X size={14} />
                    {t("reports.dismiss")}
                  </Button>
                  <Button size="sm" onClick={() => setResolving(r)}>
                    <Check size={14} />
                    {t("reports.markResolved")}
                  </Button>
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Modal
        open={!!resolving}
        onClose={() => setResolving(null)}
        title={t("reports.markResolved")}
        subtitle={t("reports.noteOptional")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setResolving(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              loading={resolve.isPending}
              onClick={() => resolving && resolve.mutate({ id: resolving.id, status: "resolved", note: note.trim() })}
            >
              <Flag size={14} />
              {t("reports.markResolved")}
            </Button>
          </>
        }
      >
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={t("reports.notePlaceholder")}
          aria-label={t("reports.note")}
        />
      </Modal>
    </>
  );
}
