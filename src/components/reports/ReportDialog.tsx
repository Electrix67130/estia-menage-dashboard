"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import {
  REPORT_REASONS,
  useCreateReport,
  type CreateReportInput,
  type ReportReason,
  type ReportTarget,
} from "@/hooks/useReports";

/** Ce qu'on signale : son type, son identifiant, et comment le montrer (extrait, nom). */
export interface ReportTargetRef {
  type: ReportTarget;
  id: string;
  label: string;
}

const TITLE_KEY: Record<ReportTarget, string> = {
  comment: "report.title",
  photo: "report.titlePhoto",
  user: "report.titleUser",
};

/** Le corps envoyé à `POST /reports` : une précision faite d'espaces n'en est pas une. */
export function buildReportInput(target: ReportTargetRef, reason: ReportReason, comment: string): CreateReportInput {
  const trimmed = comment.trim();
  return {
    target_type: target.type,
    target_id: target.id,
    reason,
    ...(trimmed ? { comment: trimmed } : {}),
  };
}

interface Props {
  target: ReportTargetRef | null;
  onClose: () => void;
}

/**
 * Signaler un message, une photo ou un membre (repris de Buildr). Le
 * signalement part aux administrateurs de l'organisation, jamais à la personne
 * visée.
 */
export default function ReportDialog({ target, onClose }: Props) {
  const { t } = useI18n();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState("");
  const send = useCreateReport();

  const reset = () => {
    setReason(null);
    setComment("");
  };

  const close = () => {
    if (send.isPending) return;
    reset();
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!target || !reason) return;
    send.mutate(buildReportInput(target, reason, comment), {
      onSuccess: () => {
        toast.success(t("report.sent"));
        reset();
        onClose();
      },
      onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
    });
  };

  return (
    <Modal
      open={!!target}
      onClose={close}
      size="sm"
      title={target ? t(TITLE_KEY[target.type]) : t("report.title")}
      subtitle={t("report.subtitle")}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={send.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="report-form" variant="danger" disabled={!reason} loading={send.isPending}>
            {t("report.submit")}
          </Button>
        </>
      }
    >
      <form id="report-form" onSubmit={submit} className="flex flex-col gap-4">
        {target?.label ? (
          <blockquote className="rounded-lg border-l-2 border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
            <p className="line-clamp-3 whitespace-pre-wrap break-words">{target.label}</p>
          </blockquote>
        ) : null}

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("report.reason")}</legend>
          {REPORT_REASONS.map((r) => (
            <label
              key={r}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors",
                reason === r
                  ? "border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
                  : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800/50",
              )}
            >
              <input
                type="radio"
                name="report-reason"
                value={r}
                checked={reason === r}
                onChange={() => setReason(r)}
                className="h-4 w-4 accent-rose-600"
              />
              {t(`report.reason.${r}`)}
            </label>
          ))}
        </fieldset>

        <Textarea
          label={`${t("report.details")} (${t("common.optional")})`}
          name="report-details"
          placeholder={t("report.detailsPlaceholder")}
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <p className="text-xs text-zinc-500">{t("report.hint")}</p>
      </form>
    </Modal>
  );
}
