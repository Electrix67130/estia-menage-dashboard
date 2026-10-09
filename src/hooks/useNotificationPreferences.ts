import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** Catégories de notifications, dans l'ordre affiché. Les signalements ne concernent que les admins. */
export const NOTIFICATION_CATEGORIES = [
  { key: "mentions" },
  { key: "assignment" },
  { key: "available" },
  { key: "reminders" },
  { key: "reschedule" },
  { key: "presence" },
  { key: "pointage" },
  { key: "validation" },
  { key: "comments" },
  { key: "consumables" },
  { key: "invitations" },
  { key: "reports", adminOnly: true },
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["key"];
export type LogementNotificationLevel = "all" | "important" | "none";

export type NotificationPreferences = Record<NotificationCategory, boolean> & {
  push_enabled: boolean;
  logements: { logement_id: string; logement_name: string; level: Exclude<LogementNotificationLevel, "all"> }[];
};

const KEY = ["notification-preferences"] as const;

export function useNotificationPreferences() {
  return useQuery({ queryKey: KEY, queryFn: () => apiFetch<NotificationPreferences>("/notification-preferences") });
}

type PreferenceUpdate = { key: NotificationCategory; enabled: boolean } | { push_enabled: boolean };

/** Un interrupteur à la fois, affiché tout de suite et rétabli si l'API refuse. */
export function useUpdateNotificationPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PreferenceUpdate) => apiFetch("/notification-preferences", { method: "PATCH", body }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: KEY });
      const previous = qc.getQueryData<NotificationPreferences>(KEY);
      if (previous) {
        qc.setQueryData<NotificationPreferences>(
          KEY,
          "push_enabled" in body ? { ...previous, push_enabled: body.push_enabled } : { ...previous, [body.key]: body.enabled },
        );
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(KEY, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useLogementNotificationLevel(logementId: string | undefined) {
  return useQuery({
    queryKey: ["notification-preferences", "logement", logementId],
    queryFn: () =>
      apiFetch<{ logement_id: string; level: LogementNotificationLevel }>(
        `/notification-preferences/logements/${logementId}`,
      ),
    enabled: !!logementId,
  });
}

export function useSetLogementNotificationLevel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ logementId, level }: { logementId: string; level: LogementNotificationLevel }) =>
      apiFetch(`/notification-preferences/logements/${logementId}`, { method: "PUT", body: { level } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
