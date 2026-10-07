"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";

/**
 * Suppression de son propre compte (`DELETE /auth/account`, exigence App Store).
 *
 * L'API anonymise le compte et coupe toutes ses sessions : il n'y a donc pas de
 * `/auth/logout` à appeler, on oublie simplement la session locale, on vide le
 * cache et on renvoie vers la connexion. Les erreurs (401 mot de passe faux,
 * 409 dernier admin d'une org peuplée) remontent à l'appelant via `ApiError`.
 */
export function useDeleteAccount() {
  const qc = useQueryClient();
  const router = useRouter();
  const { clearSession } = useAuth();
  const { t } = useI18n();

  return useMutation({
    mutationFn: (password: string) =>
      // `retry: false` : un 401 ici veut dire « mot de passe faux », pas
      // « jeton expiré » — inutile de passer par le refresh.
      apiFetch<void>("/auth/account", { method: "DELETE", body: { password }, retry: false }),
    onSuccess: () => {
      clearSession();
      qc.clear();
      toast.success(t("settings.deleteAccount.done"));
      router.replace("/login");
    },
  });
}
