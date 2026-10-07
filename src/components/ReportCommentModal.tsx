"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Textarea from "@/components/ui/Textarea";
import { ApiError } from "@/lib/api";
import { feedbackApi, type CreateFeedbackInput } from "@/lib/feedback-api";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

/** Motifs proposés : la clé i18n sert aussi de libellé envoyé en `subject`. */
export const REPORT_REASONS = ["inappropriate", "harassment", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Longueur minimale du `message` acceptée par l'API (`POST /feedbacks`). */
const MIN_MESSAGE_LENGTH = 10;
const EXCERPT_LENGTH = 30;

/** Les 30 premiers caractères du commentaire, « … » s'il est coupé. */
export function commentExcerpt(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH)}…` : flat;
}

/**
 * Construit le signalement envoyé à l'API. Le `message` doit faire 10
 * caractères : si l'utilisateur n'a rien précisé (ou trop peu), on envoie un
 * texte de repli qui cite le commentaire, pour que l'admin sache de quoi il
 * s'agit même si le commentaire est supprimé entre-temps.
 */
export function buildReportPayload(input: {
  reasonLabel: string;
  details: string;
  comment: { id: string; content: string };
  fallbackMessage: string;
  locale: string;
  screen?: string;
}): CreateFeedbackInput {
  const details = input.details.trim();
  const message =
    details.length >= MIN_MESSAGE_LENGTH
      ? details
      : [input.fallbackMessage, details].filter(Boolean).join(" — ");
  return {
    type: "report",
    subject: input.reasonLabel,
    message,
    target_type: "comment",
    target_id: input.comment.id,
    platform: "web",
    screen: input.screen,
    locale: input.locale,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  comment: { id: string; content: string };
}

/** Signaler un commentaire d'un autre utilisateur aux admins de l'organisation. */
export default function ReportCommentModal({ open, onClose, comment }: Props) {
  const { t, locale } = useI18n();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  const reset = () => {
    setReason(null);
    setDetails("");
  };

  const close = () => {
    if (send.isPending) return;
    reset();
    onClose();
  };

  const send = useMutation({
    mutationFn: (r: ReportReason) =>
      feedbackApi.create(
        buildReportPayload({
          reasonLabel: t(`report.reason.${r}`),
          details,
          comment,
          fallbackMessage: t("report.fallbackMessage", { excerpt: commentExcerpt(comment.content) }),
          locale,
          screen: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      ),
    onSuccess: () => {
      toast.success(t("report.sent"));
      reset();
      onClose();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    send.mutate(reason);
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={t("report.title")}
      subtitle={t("report.subtitle")}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={send.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="report-comment-form"
            variant="danger"
            disabled={!reason}
            loading={send.isPending}
          >
            {t("report.submit")}
          </Button>
        </>
      }
    >
      <form id="report-comment-form" onSubmit={submit} className="flex flex-col gap-4">
        <blockquote className="rounded-lg border-l-2 border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
            {t("report.quoted")}
          </p>
          <p className="line-clamp-3 whitespace-pre-wrap break-words">{comment.content}</p>
        </blockquote>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {t("report.reason")}
          </legend>
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
          maxLength={5000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
        />
      </form>
    </Modal>
  );
}
