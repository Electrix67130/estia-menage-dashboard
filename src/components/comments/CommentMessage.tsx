"use client";

import { useEffect, useRef, useState } from "react";
import { Ban, Flag, Reply, SmilePlus } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";
import { formatDateFr } from "@/lib/date-fr";
import { splitMentions } from "@/lib/mentions";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/reactions";
import type { Comment } from "@/hooks/useMenageCheck";

interface Props {
  comment: Comment;
  isOwn: boolean;
  /** Mis en évidence un instant quand on arrive depuis une citation. */
  highlighted?: boolean;
  onReply: () => void;
  onReact: (emoji: ReactionEmoji) => void;
  /** Absents sur ses propres messages : on ne se signale ni ne se bloque. */
  onReport?: () => void;
  onBlock?: () => void;
  /** Clic sur la citation : remonter au message d'origine. */
  onJumpTo: (commentId: string) => void;
}

const toolbarButton =
  "rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200";

/**
 * Un message de la discussion d'une prestation (repris de Buildr) : citation
 * du message auquel il répond, mentions surlignées, réactions, et une barre
 * d'actions au survol — réagir, répondre, signaler, bloquer.
 */
export default function CommentMessage({
  comment,
  isOwn,
  highlighted = false,
  onReply,
  onReact,
  onReport,
  onBlock,
  onJumpTo,
}: Props) {
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const reactions = comment.reactions ?? [];
  const author = `${comment.first_name ?? ""} ${comment.last_name ?? ""}`.trim();

  // Le sélecteur d'emoji se ferme au clic ailleurs et à Échap.
  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPickerOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [pickerOpen]);

  return (
    <li id={`comment-${comment.id}`} className={cn("group flex gap-3", isOwn ? "flex-row-reverse" : "flex-row")}>
      <Avatar firstName={comment.first_name ?? ""} lastName={comment.last_name ?? ""} src={comment.avatar_url} size="sm" />

      <div className={cn("flex min-w-0 max-w-[80%] flex-col", isOwn ? "items-end" : "items-start")}>
        <div
          className={cn(
            "min-w-0 rounded-lg px-3 py-2 transition-shadow",
            isOwn ? "bg-blue-100 dark:bg-blue-900/30" : "bg-zinc-100 dark:bg-zinc-800",
            highlighted && "ring-2 ring-blue-500",
          )}
        >
          <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{author}</p>

          {comment.reply_to ? (
            <button
              type="button"
              onClick={() => onJumpTo(comment.reply_to!.id)}
              className="mt-1 block w-full rounded border-l-2 border-blue-400 bg-white/60 px-2 py-1 text-left text-xs text-zinc-600 hover:bg-white dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-900/70"
            >
              <span className="block font-semibold text-zinc-700 dark:text-zinc-300">
                {comment.reply_to.first_name} {comment.reply_to.last_name}
              </span>
              <span className="line-clamp-2 whitespace-pre-wrap break-words">{comment.reply_to.content}</span>
            </button>
          ) : null}

          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-900 dark:text-zinc-100">
            {splitMentions(comment.content, comment.mentions).map((segment, i) =>
              segment.mention ? (
                <span key={i} className="font-semibold text-blue-600 dark:text-blue-400">
                  {segment.text}
                </span>
              ) : (
                segment.text
              ),
            )}
          </p>
          <p className="mt-1 text-[10px] text-zinc-500">{formatDateFr(comment.created_at, "datetime")}</p>
        </div>

        {reactions.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                aria-pressed={r.mine}
                aria-label={t("comments.reactionCount", { emoji: r.emoji, count: r.count })}
                onClick={() => onReact(r.emoji)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors",
                  r.mine
                    ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Barre d'actions : au survol, ou dès qu'un de ses boutons a le focus clavier. */}
      <div
        className={cn(
          "relative flex items-center gap-0.5 self-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
          pickerOpen && "opacity-100",
        )}
      >
        <div ref={pickerRef} className="relative">
          <button
            type="button"
            className={toolbarButton}
            onClick={() => setPickerOpen((v) => !v)}
            aria-label={t("comments.react")}
            aria-expanded={pickerOpen}
            title={t("comments.react")}
          >
            <SmilePlus size={14} />
          </button>
          {pickerOpen ? (
            <div
              role="menu"
              aria-label={t("comments.react")}
              className={cn(
                "absolute bottom-full z-20 mb-1 flex gap-0.5 rounded-full border border-zinc-200 bg-white px-1.5 py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900",
                isOwn ? "right-0" : "left-0",
              )}
            >
              {REACTION_EMOJIS.map((emoji) => {
                const mine = reactions.some((r) => r.emoji === emoji && r.mine);
                return (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    aria-label={emoji}
                    onClick={() => {
                      onReact(emoji);
                      setPickerOpen(false);
                    }}
                    className={cn(
                      "rounded-full p-1 text-lg leading-none transition-transform hover:scale-125",
                      mine && "bg-blue-100 dark:bg-blue-900/40",
                    )}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <button type="button" className={toolbarButton} onClick={onReply} aria-label={t("comments.reply")} title={t("comments.reply")}>
          <Reply size={14} />
        </button>
        {onReport ? (
          <button
            type="button"
            className={cn(toolbarButton, "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400")}
            onClick={onReport}
            aria-label={t("report.action")}
            title={t("report.action")}
          >
            <Flag size={14} />
          </button>
        ) : null}
        {onBlock ? (
          <button
            type="button"
            className={cn(toolbarButton, "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-900/20 dark:hover:text-rose-400")}
            onClick={onBlock}
            aria-label={t("block.actionNamed", { name: author })}
            title={t("block.actionNamed", { name: author })}
          >
            <Ban size={14} />
          </button>
        ) : null}
      </div>
    </li>
  );
}
