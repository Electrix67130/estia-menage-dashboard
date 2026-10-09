"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Reply, Send, X } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import CommentMessage from "@/components/comments/CommentMessage";
import ReportDialog, { type ReportTargetRef } from "@/components/reports/ReportDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { useConfirm } from "@/contexts/DialogContext";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  activeMentionQuery,
  filterMentionCandidates,
  insertMention,
  mentionedIdsInText,
  mentionName,
  type MentionCandidate,
} from "@/lib/mentions";
import {
  useCreateComment,
  useMenageComments,
  useMentionable,
  useToggleReaction,
  type Comment,
} from "@/hooks/useMenageCheck";
import { useBlockUser } from "@/hooks/useBlocks";

/** Durée de la mise en évidence d'un message atteint depuis une citation. */
const HIGHLIGHT_MS = 1600;
const REPORT_EXCERPT = 120;

const authorName = (c: Pick<Comment, "first_name" | "last_name">) =>
  `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();

/** Ce que montre la fenêtre de signalement d'un message : « Prénom Nom : début du message ». */
export function commentReportLabel(c: Pick<Comment, "first_name" | "last_name" | "content">): string {
  const flat = c.content.replace(/\s+/g, " ").trim();
  const excerpt = flat.length > REPORT_EXCERPT ? `${flat.slice(0, REPORT_EXCERPT)}…` : flat;
  return `${authorName(c)} : ${excerpt}`;
}

/**
 * Discussion d'une prestation : mentions « @ », réponses citées, réactions,
 * signalement et blocage (ces trois derniers repris de Buildr).
 */
export default function CommentsThread({ menageId }: { menageId: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const confirm = useConfirm();
  const comments = useMenageComments(menageId);
  const create = useCreateComment(menageId);
  const react = useToggleReaction(menageId);
  const block = useBlockUser();
  const mentionable = useMentionable(menageId).data ?? [];
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [reporting, setReporting] = useState<ReportTargetRef | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mentions « @ » : liste basée sur ce qui est tapé juste avant le curseur.
  const inputRef = useRef<HTMLInputElement>(null);
  const [cursor, setCursor] = useState(0);
  const [highlighted, setHighlighted] = useState(0);
  const [mentionDismissed, setMentionDismissed] = useState(false);
  const activeMention = mentionDismissed ? null : activeMentionQuery(draft, Math.min(cursor, draft.length));
  const suggestions = activeMention ? filterMentionCandidates(mentionable, activeMention.query) : [];

  useEffect(
    () => () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    },
    [],
  );

  const pickMention = (candidate: MentionCandidate) => {
    if (!activeMention) return;
    const next = insertMention(draft, activeMention.start, Math.min(cursor, draft.length), candidate);
    setDraft(next.text);
    setCursor(next.cursor);
    setHighlighted(0);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(next.cursor, next.cursor);
    });
  };

  const handleKeys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length > 0) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        setHighlighted((i) => (i + step + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        // Entrée choisit la personne au lieu d'envoyer le message.
        e.preventDefault();
        pickMention(suggestions[Math.min(highlighted, suggestions.length - 1)]);
      } else if (e.key === "Escape") {
        setMentionDismissed(true);
      }
      return;
    }
    // Échap sans liste de mentions ouverte : on renonce à répondre.
    if (e.key === "Escape" && replyTo) setReplyTo(null);
  };

  const beginReply = (c: Comment) => {
    setReplyTo(c);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const jumpTo = (commentId: string) => {
    document.getElementById(`comment-${commentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(commentId);
    if (highlightTimer.current) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
  };

  const blockAuthor = async (c: Comment) => {
    const name = authorName(c);
    const ok = await confirm({
      title: t("block.confirmTitle", { name }),
      description: t("block.confirmBody"),
      confirmLabel: t("block.action"),
      tone: "danger",
    });
    if (!ok) return;
    block.mutate(c.author_id, {
      onSuccess: () => toast.success(t("block.done", { name })),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
    });
  };

  const handleSend = async () => {
    if (!draft.trim()) return;
    try {
      await create.mutateAsync({
        content: draft.trim(),
        mentioned_user_ids: mentionedIdsInText(draft, mentionable),
        reply_to_id: replyTo?.id ?? null,
      });
      setDraft("");
      setCursor(0);
      setReplyTo(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("common.error"));
    }
  };

  if (comments.isLoading) return <p className="text-sm text-zinc-500">{t("common.loading")}</p>;
  if (comments.error)
    return (
      <p className="text-sm text-rose-600">
        {comments.error instanceof Error ? comments.error.message : t("common.error")}
      </p>
    );

  const items = comments.data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("menageDetail.comments.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((c) => {
            const isOwn = c.author_id === user?.id;
            return (
              <CommentMessage
                key={c.id}
                comment={c}
                isOwn={isOwn}
                highlighted={highlightedId === c.id}
                onReply={() => beginReply(c)}
                onReact={(emoji) => react.mutate({ commentId: c.id, emoji })}
                onReport={isOwn ? undefined : () => setReporting({ type: "comment", id: c.id, label: commentReportLabel(c) })}
                onBlock={isOwn ? undefined : () => blockAuthor(c)}
                onJumpTo={jumpTo}
              />
            );
          })}
        </ul>
      )}

      <ReportDialog target={reporting} onClose={() => setReporting(null)} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex flex-col gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800"
      >
        {replyTo ? (
          <div className="flex items-center gap-2 rounded-lg border-l-2 border-blue-500 bg-blue-50 px-3 py-2 text-sm dark:bg-blue-900/20">
            <Reply size={14} className="shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                {t("comments.replyingTo", { name: authorName(replyTo) })}
              </p>
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-400">{replyTo.content}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="rounded p-1 text-zinc-500 hover:bg-blue-100 hover:text-zinc-800 dark:hover:bg-blue-900/40 dark:hover:text-zinc-200"
              aria-label={t("comments.cancelReply")}
              title={t("comments.cancelReply")}
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            {suggestions.length > 0 ? (
              <ul
                role="listbox"
                aria-label={t("menageDetail.comments.mention")}
                className="absolute bottom-full left-0 right-0 z-20 mb-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
              >
                {suggestions.map((candidate, i) => (
                  <li key={candidate.id} role="option" aria-selected={i === highlighted}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onMouseEnter={() => setHighlighted(i)}
                      onClick={() => pickMention(candidate)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-900 dark:text-zinc-100",
                        i === highlighted && "bg-blue-50 dark:bg-blue-900/20",
                      )}
                    >
                      <Avatar
                        firstName={candidate.first_name}
                        lastName={candidate.last_name}
                        src={candidate.avatar_url ?? undefined}
                        size="sm"
                      />
                      <span className="truncate">{mentionName(candidate)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <Input
              ref={inputRef}
              placeholder={t("menageDetail.comments.placeholder")}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setCursor(e.target.selectionStart ?? e.target.value.length);
                setMentionDismissed(false);
                setHighlighted(0);
              }}
              onSelect={(e) => setCursor(e.currentTarget.selectionStart ?? 0)}
              onKeyDown={handleKeys}
              autoComplete="off"
              aria-label={t("menageDetail.comments.placeholder")}
            />
          </div>
          <Button
            type="submit"
            disabled={!draft.trim() || create.isPending}
            loading={create.isPending}
            aria-label={t("common.send")}
          >
            <Send size={14} />
          </Button>
        </div>
      </form>
    </div>
  );
}
