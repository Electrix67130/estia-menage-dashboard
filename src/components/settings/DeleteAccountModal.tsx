"use client";

import { FormEvent, useState } from "react";
import { TriangleAlert } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { ApiError } from "@/lib/api";
import { useDeleteAccount } from "@/hooks/useDeleteAccount";
import { useI18n } from "@/contexts/I18nContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Confirmation de suppression de compte : le texte d'avertissement, le mot de
 * passe (l'API l'exige) et un bouton rouge inactif tant que le champ est vide.
 */
export default function DeleteAccountModal({ open, onClose }: Props) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const remove = useDeleteAccount();

  const close = () => {
    if (remove.isPending) return;
    setPassword("");
    setError(null);
    onClose();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError(null);
    remove.mutate(password, {
      onError: (err) => {
        if (err instanceof ApiError && err.statusCode === 401) {
          setError(t("settings.deleteAccount.wrongPassword"));
        } else if (err instanceof ApiError && err.statusCode === 409) {
          setError(err.message);
        } else {
          setError(t("settings.deleteAccount.error"));
        }
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="sm"
      title={t("settings.deleteAccount.modalTitle")}
      subtitle={t("settings.deleteAccount.modalSubtitle")}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={close} disabled={remove.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="delete-account-form"
            variant="danger"
            disabled={!password}
            loading={remove.isPending}
          >
            {t("settings.deleteAccount.confirm")}
          </Button>
        </>
      }
    >
      <form id="delete-account-form" onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <TriangleAlert size={18} className="mt-0.5 flex-shrink-0" />
          <p>{t("settings.deleteAccount.description")}</p>
        </div>
        <Input
          label={t("settings.deleteAccount.passwordLabel")}
          type="password"
          name="delete-account-password"
          autoComplete="current-password"
          placeholder={t("settings.deleteAccount.passwordPlaceholder")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error ?? undefined}
          autoFocus
        />
      </form>
    </Modal>
  );
}
