"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/ui/Modal";
import { useEligiblePrestataires, type EligiblePrestataire } from "@/hooks/useMenageDetail";
import { useSetMenagePrestataires } from "@/hooks/useMenagePrestataires";
import { useRelanceMenage } from "@/hooks/useMenageResponses";
import { useI18n } from "@/contexts/I18nContext";
import type { TFn } from "@/i18n/translations";
import { ApiError } from "@/lib/api";
import { formatRelativeFr } from "@/lib/date-fr";
import { cn } from "@/lib/utils";

type GroupKey = "present" | "none" | "absent";

const GROUP_TITLE_KEY: Record<GroupKey, string> = {
  present: "picker.groupPresent",
  none: "picker.groupNone",
  absent: "picker.groupAbsent",
};

const GROUP_TITLE_CLASS: Record<GroupKey, string> = {
  present: "text-teal-600 dark:text-teal-400",
  none: "text-zinc-500 dark:text-zinc-400",
  absent: "text-rose-600 dark:text-rose-400",
};

function errorMessage(err: unknown, t: TFn): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : t("common.error");
}

/** Sous-ligne d'un prestataire : vote + ancienneté + lien au logement. */
function subline(p: EligiblePrestataire, t: TFn): string {
  const membership = p.is_member ? t("picker.member") : t("picker.nonMember");
  if (p.response_status === "present")
    return [t("picker.votePresent"), formatRelativeFr(p.responded_at), membership].filter(Boolean).join(" · ");
  if (p.response_status === "absent")
    return [t("picker.voteAbsent"), formatRelativeFr(p.responded_at), membership].filter(Boolean).join(" · ");
  return `${t("picker.notAnswered")} · ${membership}`;
}

/**
 * Modale d'affectation (multi-sélection : le premier coché est le référent),
 * groupée Disponibles / Sans réponse / Indisponibles selon les votes
 * présent/absent. Pilotée de l'extérieur (`open`/`onClose`) pour servir aussi
 * bien le détail que le bouton « Affecter » des cartes de la liste.
 */
export function PrestatairePickerModal({
  menageId,
  currentIds,
  open,
  onClose,
}: {
  menageId: string;
  /** Prestataires déjà affectés (référent en premier). */
  currentIds: string[];
  open: boolean;
  onClose: () => void;
}) {
  const { t, tp } = useI18n();
  const eligible = useEligiblePrestataires(open ? menageId : undefined);
  const setPrestas = useSetMenagePrestataires(menageId);
  const relance = useRelanceMenage();
  const [selectedIds, setSelectedIds] = useState<string[]>(currentIds);

  const groups = useMemo(() => {
    const data = eligible.data ?? [];
    const out: { key: GroupKey; items: EligiblePrestataire[] }[] = [
      { key: "present", items: data.filter((p) => p.response_status === "present") },
      { key: "none", items: data.filter((p) => p.response_status === null) },
      { key: "absent", items: data.filter((p) => p.response_status === "absent") },
    ];
    return out.filter((g) => g.items.length > 0);
  }, [eligible.data]);

  // Seuls les membres du logement reçoivent la relance (l'API ne pousse pas aux
  // prestataires hors logement) : on annonce le vrai nombre de destinataires.
  const relanceTargets = (eligible.data ?? []).filter(
    (p) => p.response_status === null && p.is_member,
  ).length;

  const toggleId = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    try {
      await setPrestas.mutateAsync(selectedIds);
      toast.success(
        selectedIds.length === 0
          ? t("picker.removed")
          : selectedIds.length === 1
            ? t("picker.assignedOne")
            : t("picker.assignedMany", { count: selectedIds.length }),
      );
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const handleRelance = async () => {
    try {
      const { sent } = await relance.mutateAsync(menageId);
      toast.success(sent === 0 ? t("picker.everyoneAnswered") : tp("picker.relanceSent", sent));
    } catch (err) {
      toast.error(errorMessage(err, t));
    }
  };

  const n = selectedIds.length;
  const saveLabel =
    n === 0
      ? currentIds.length > 0
        ? t("picker.removeAll")
        : t("common.assign")
      : tp("picker.assignCount", n);

  if (!open) return null;

  return (
    <Modal open onClose={onClose} title={t("picker.title")}>
      <div className="flex flex-col gap-4">
        {eligible.isLoading ? (
          <p className="text-sm text-zinc-500">{t("common.loading")}</p>
        ) : (eligible.data ?? []).length === 0 ? (
          <p className="text-sm text-blue-600">{t("picker.noEligible")}</p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="flex flex-col gap-1.5">
              <header className="flex items-center justify-between gap-2">
                <h3
                  className={cn(
                    "text-xs font-bold uppercase tracking-wider",
                    GROUP_TITLE_CLASS[group.key],
                  )}
                >
                  {t(GROUP_TITLE_KEY[group.key])} ({group.items.length})
                </h3>
                {group.key === "none" && relanceTargets > 0 ? (
                  <button
                    type="button"
                    onClick={handleRelance}
                    disabled={relance.isPending}
                    className="text-xs font-semibold text-blue-600 hover:underline disabled:text-zinc-400 disabled:no-underline dark:text-blue-400"
                  >
                    {relance.isPending ? t("common.sending") : t("picker.relanceN", { count: relanceTargets })}
                  </button>
                ) : null}
              </header>
              <ul className="flex flex-col gap-1">
                {group.items.map((p) => {
                  const checked = selectedIds.includes(p.id);
                  const isPrimary = checked && selectedIds[0] === p.id;
                  const inputId = `presta-${menageId}-${p.id}`;
                  return (
                    <li key={p.id}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/40",
                          group.key === "absent" && "opacity-60",
                        )}
                        htmlFor={inputId}
                      >
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleId(p.id)}
                          className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <Avatar
                          firstName={p.first_name}
                          lastName={p.last_name}
                          src={p.avatar_url ?? undefined}
                          size="sm"
                          className={
                            group.key === "present"
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                              : undefined
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                            {p.first_name} {p.last_name}
                          </p>
                          <p className="truncate text-xs text-zinc-500">{subline(p, t)}</p>
                        </div>
                        {isPrimary ? (
                          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {t("picker.primary")}
                          </span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        <p className="text-xs text-zinc-500">
          <strong>{t("picker.hintPrimary")}</strong> {t("picker.hintExternal")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            loading={setPrestas.isPending}
            disabled={n === 0 && currentIds.length === 0}
          >
            {saveLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Bouton « Affecter » / « Modifier » + modale, tel qu'utilisé par le détail
 * d'une prestation. La sélection repart des affectations actuelles à chaque
 * ouverture (la modale est remontée à l'ouverture).
 */
export default function PrestatairePicker({
  menageId,
  current,
}: {
  menageId: string;
  current: { user_id: string }[];
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const currentIds = current.map((c) => c.user_id);
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        {current.length > 0 ? t("common.edit") : t("common.assign")}
      </Button>
      {open ? (
        <PrestatairePickerModal
          menageId={menageId}
          currentIds={currentIds}
          open
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
