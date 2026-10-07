"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bug, Lightbulb, Search, Plus, Flag } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import ReportTargetInfo from "@/components/ReportTargetInfo";
import { ApiError } from "@/lib/api";
import {
  feedbackApi,
  type FeedbackStatus,
  type FeedbackType,
  type FeedbackWithAuthor,
} from "@/lib/feedback-api";
import { formatDateTime, cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";

const STATUS_VARIANT: Record<FeedbackStatus, "default" | "info" | "success" | "danger"> = {
  new: "default",
  in_progress: "info",
  resolved: "success",
  declined: "danger",
};

const STATUSES: FeedbackStatus[] = ["new", "in_progress", "resolved", "declined"];

const TYPE_KEY: Record<FeedbackType, string> = {
  bug: "support.typeBug",
  suggestion: "support.typeSuggestion",
  report: "support.typeReport",
};

function TypeIcon({ type }: { type: FeedbackType }) {
  if (type === "bug") return <Bug size={16} />;
  if (type === "report") return <Flag size={16} />;
  return <Lightbulb size={16} />;
}

/**
 * Signalements : bugs et suggestions envoyés par les membres de l'organisation.
 *
 * Deux usages dans une page. Tout le monde peut déposer un signalement ; seuls
 * les admins voient ceux des autres et y répondent — l'API applique la même
 * règle, la page ne fait que refléter.
 */
export default function FeedbacksPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const queryClient = useQueryClient();

  const [status, setStatus] = useState<FeedbackStatus | undefined>();
  const [type, setType] = useState<FeedbackType | "">("");
  const [recherche, setRecherche] = useState("");
  const [q, setQ] = useState("");
  const [selection, setSelection] = useState<FeedbackWithAuthor | null>(null);
  const [creation, setCreation] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["feedbacks", { status, type, q }],
    queryFn: () => feedbackApi.list({ status, type: type || undefined, q: q || undefined }),
    enabled: isAdmin,
    refetchInterval: 60000,
  });

  // Un non-admin ne voit que ses propres signalements et les réponses reçues.
  const mine = useQuery({
    queryKey: ["feedbacks", "mine"],
    queryFn: () => feedbackApi.mine(),
    enabled: !isAdmin,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {isAdmin ? t("feedback.orgTitle") : t("support.title")}
          </h1>
          <p className="text-sm text-zinc-500">
            {t("support.subtitle")}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreation(true)}>
          <Plus size={14} />
          {t("support.send")}
        </Button>
      </div>

      {isAdmin ? (
        <>
          {/* Onglets de statut : la console se lit par ce qui reste à traiter. */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStatus(undefined)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                status === undefined
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
              )}
            >
              {t("admin.feedbackAll")}
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  status === s
                    ? "bg-blue-600 text-white"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300",
                )}
              >
                {t(`support.status.${s}`)}
                {data?.counts?.[s] ? <span className="ml-1.5 opacity-70">{data.counts[s]}</span> : null}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setQ(recherche.trim());
              }}
            >
              <Input
                label={t("admin.feedbackSearch")}
                placeholder={t("admin.feedbackSearchPlaceholder")}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
              <Button type="submit" variant="secondary">
                <Search size={16} />
              </Button>
            </form>

            <Select
              label={t("support.type")}
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType | "")}
            >
              <option value="">{t("admin.feedbackAllTypes")}</option>
              <option value="bug">{t("support.typeBug")}</option>
              <option value="suggestion">{t("support.typeSuggestion")}</option>
              <option value="report">{t("support.typeReport")}</option>
            </Select>
          </div>

          <Card className="p-0">
            {isLoading ? (
              <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>
            ) : data && data.data.length > 0 ? (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {data.data.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setSelection(f)}
                      className="flex w-full items-start gap-3 px-6 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <span className="mt-0.5 text-zinc-400">
                        <TypeIcon type={f.type} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={STATUS_VARIANT[f.status]}>
                            {t(`support.status.${f.status}`)}
                          </Badge>
                          {f.type === "report" ? (
                            <Badge variant="danger">{t("feedback.reportBadge")}</Badge>
                          ) : null}
                          {f.platform ? <Badge variant="info">{f.platform}</Badge> : null}
                          {f.app_version ? (
                            <span className="text-xs text-zinc-500">v{f.app_version}</span>
                          ) : null}
                          {f.locale !== "fr" ? (
                            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs uppercase dark:bg-zinc-800">
                              {f.locale}
                            </code>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-sm font-medium text-zinc-900 dark:text-white">
                          {f.subject}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {[f.author_first_name, f.author_last_name].filter(Boolean).join(" ") ||
                            f.author_email ||
                            t("admin.feedbackDeletedAuthor")}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-zinc-500">
                        {formatDateTime(f.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-sm text-zinc-500">{t("admin.feedbackEmpty")}</p>
            )}
          </Card>
        </>
      ) : (
        /* Vue « mes signalements » pour un non-admin. */
        <Card className="p-0">
          {mine.isLoading ? (
            <p className="p-6 text-sm text-zinc-500">{t("common.loading")}</p>
          ) : mine.data && mine.data.data.length > 0 ? (
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {mine.data.data.map((f) => (
                <li key={f.id} className="flex flex-col gap-2 px-6 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={STATUS_VARIANT[f.status]}>{t(`support.status.${f.status}`)}</Badge>
                    {f.type === "report" ? (
                      <Badge variant="danger">{t("feedback.reportBadge")}</Badge>
                    ) : null}
                    <span className="text-sm font-medium text-zinc-900 dark:text-white">
                      {f.subject}
                    </span>
                    <span className="ml-auto text-xs text-zinc-500">
                      {formatDateTime(f.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">
                    {f.message}
                  </p>
                  {f.response ? (
                    <div className="rounded-lg border-l-2 border-blue-500 bg-blue-50 px-3 py-2 dark:bg-blue-950/30">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                        {t("support.responseFrom")}
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                        {f.response}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic text-zinc-500">{t("support.awaitingResponse")}</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-6 text-sm text-zinc-500">{t("support.emptyDescription")}</p>
          )}
        </Card>
      )}

      {creation ? (
        <NewFeedbackModal
          onClose={() => setCreation(false)}
          onSaved={async () => {
            setCreation(false);
            await queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
          }}
        />
      ) : null}

      {selection ? (
        <FeedbackDetail
          feedback={selection}
          onClose={() => setSelection(null)}
          onSaved={async () => {
            setSelection(null);
            await queryClient.invalidateQueries({ queryKey: ["feedbacks"] });
          }}
        />
      ) : null}
    </div>
  );
}

/** Dépôt d'un signalement — ouvert à tout utilisateur connecté. */
function NewFeedbackModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const [type, setType] = useState<FeedbackType>("bug");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Bornes du schéma de l'API : les rappeler ici évite un aller-retour pour un 400.
  const valide = subject.trim().length >= 3 && message.trim().length >= 10;

  const envoyer = useMutation({
    mutationFn: () =>
      feedbackApi.create({
        type,
        subject: subject.trim(),
        message: message.trim(),
        platform: "web",
        screen: typeof window !== "undefined" ? window.location.pathname : undefined,
        locale,
      }),
    onSuccess: async () => {
      toast.success(t("support.sent"));
      await onSaved();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={t("support.title")}
      subtitle={t("support.subtitle")}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => envoyer.mutate()} disabled={!valide} loading={envoyer.isPending}>
            {t("support.send")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label={t("support.type")}
          value={type}
          onChange={(e) => setType(e.target.value as FeedbackType)}
        >
          <option value="bug">{t("support.typeBug")}</option>
          <option value="suggestion">{t("support.typeSuggestion")}</option>
        </Select>
        <Input
          label={t("support.subject")}
          placeholder={
            type === "bug"
              ? t("support.subjectPlaceholderBug")
              : t("support.subjectPlaceholderIdea")
          }
          value={subject}
          maxLength={150}
          onChange={(e) => setSubject(e.target.value)}
        />
        <Textarea
          label={t("support.message")}
          hint={t("support.messageHint")}
          placeholder={
            type === "bug"
              ? t("support.messagePlaceholderBug")
              : t("support.messagePlaceholderIdea")
          }
          rows={6}
          value={message}
          maxLength={5000}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>
    </Modal>
  );
}

/** Fiche d'un signalement, côté admin : lecture, réponse, statut. */
function FeedbackDetail({
  feedback,
  onClose,
  onSaved,
}: {
  feedback: FeedbackWithAuthor;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useI18n();
  const [reponse, setReponse] = useState(feedback.response ?? "");
  // Statut vide = « laisser l'API décider » : écrire une réponse suffit à
  // passer le signalement en traité.
  const [statut, setStatut] = useState<FeedbackStatus | "">("");

  const enregistrer = useMutation({
    mutationFn: () =>
      feedbackApi.respond(feedback.id, {
        ...(statut ? { status: statut } : {}),
        ...(reponse.trim() !== (feedback.response ?? "")
          ? { response: reponse.trim() || null }
          : {}),
      }),
    onSuccess: async () => {
      toast.success(t("admin.feedbackSaved"));
      await onSaved();
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : t("common.error")),
  });

  const rienAEnregistrer = !statut && reponse.trim() === (feedback.response ?? "");
  const auteur =
    [feedback.author_first_name, feedback.author_last_name].filter(Boolean).join(" ") ||
    feedback.author_email ||
    t("admin.feedbackDeletedAuthor");

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={feedback.subject}
      subtitle={auteur}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => enregistrer.mutate()}
            disabled={rienAEnregistrer}
            loading={enregistrer.isPending}
          >
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[feedback.status]}>
            {t(`support.status.${feedback.status}`)}
          </Badge>
          <Badge variant={feedback.type === "report" ? "danger" : "default"}>
            {feedback.type === "report" ? t("feedback.reportBadge") : t(TYPE_KEY[feedback.type])}
          </Badge>
          {feedback.platform ? <Badge variant="info">{feedback.platform}</Badge> : null}
          {feedback.app_version ? (
            <span className="text-xs text-zinc-500">v{feedback.app_version}</span>
          ) : null}
          {feedback.screen ? (
            <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
              {feedback.screen}
            </code>
          ) : null}
          <span className="text-xs text-zinc-500">{formatDateTime(feedback.created_at)}</span>
        </div>

        {feedback.type === "report" ? (
          <ReportTargetInfo target_type={feedback.target_type} target_id={feedback.target_id} />
        ) : null}

        <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 p-4 text-sm text-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-200">
          {feedback.message}
        </p>

        {/* La langue du message : y répondre en français alors qu'il est écrit
            en turc n'aiderait personne. */}
        <p className="text-xs text-zinc-500">
          {t("admin.feedbackWrittenIn")} <strong className="uppercase">{feedback.locale}</strong>
        </p>

        <Textarea
          label={t("admin.feedbackResponse")}
          hint={t("admin.feedbackResponseHint")}
          rows={5}
          value={reponse}
          maxLength={5000}
          onChange={(e) => setReponse(e.target.value)}
        />

        <Select
          label={t("admin.feedbackStatus")}
          value={statut}
          onChange={(e) => setStatut(e.target.value as FeedbackStatus | "")}
        >
          <option value="">{t("admin.feedbackStatusAuto")}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`support.status.${s}`)}
            </option>
          ))}
        </Select>

        {feedback.responded_by ? (
          <p className="text-xs text-zinc-500">
            {t("admin.feedbackAnsweredBy")}{" "}
            {[feedback.responder_first_name, feedback.responder_last_name]
              .filter(Boolean)
              .join(" ") || "—"}
            {feedback.responded_at ? ` • ${formatDateTime(feedback.responded_at)}` : ""}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
