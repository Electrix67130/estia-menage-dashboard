"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { apiFetch } from "@/lib/api";
import type { Feedback } from "@/lib/feedback-api";
import type { Comment } from "@/types/api";
import { useI18n } from "@/contexts/I18nContext";

type Props = Pick<Feedback, "target_type" | "target_id">;

/**
 * Le contenu visé par un signalement (`type: report`). Le feedback ne porte que
 * l'identifiant du commentaire ; on le résout via `GET /comments/:id` pour
 * offrir un lien vers la prestation. Si la résolution échoue (commentaire
 * supprimé, accès refusé hors de son organisation), on affiche l'identifiant.
 */
export default function ReportTargetInfo({ target_type, target_id }: Props) {
  const { t } = useI18n();
  const isComment = target_type === "comment" && !!target_id;

  const comment = useQuery({
    queryKey: ["comment", target_id],
    queryFn: () => apiFetch<Comment>(`/comments/${target_id}`),
    enabled: isComment,
    retry: false,
    staleTime: 60_000,
  });

  if (!target_type || !target_id) return null;

  const kind = target_type === "comment" ? t("feedback.targetComment") : t("feedback.targetPhoto");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-rose-200 bg-rose-50/50 p-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/20">
      <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
        {t("feedback.reportTarget")} · {kind}
      </p>
      {isComment && comment.data ? (
        <>
          <blockquote className="line-clamp-4 whitespace-pre-wrap break-words border-l-2 border-rose-300 pl-3 text-zinc-700 dark:border-rose-800 dark:text-zinc-300">
            {comment.data.content}
          </blockquote>
          <Link
            href={`/menages/${comment.data.menage_id}`}
            className="inline-flex w-fit items-center gap-1.5 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <ExternalLink size={14} />
            {t("feedback.viewComment")}
          </Link>
        </>
      ) : isComment && comment.isLoading ? (
        <p className="text-xs text-zinc-500">{t("common.loading")}</p>
      ) : (
        <>
          {isComment ? (
            <p className="text-xs text-zinc-500">{t("feedback.targetUnavailable")}</p>
          ) : null}
          <p className="text-xs text-zinc-500">
            {t("feedback.targetId")} : <code className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">{target_id}</code>
          </p>
        </>
      )}
    </div>
  );
}
