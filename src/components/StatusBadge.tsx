"use client";

import Badge from "@/components/ui/Badge";
import { useI18n } from "@/contexts/I18nContext";
import type { MenageStatus } from "@/types/api";

const VARIANT: Record<MenageStatus, "default" | "info" | "success" | "warning" | "danger"> = {
  a_venir: "info",
  en_cours: "warning",
  termine: "success",
  valide: "success",
  annule: "danger",
};

const KEY: Record<MenageStatus, string> = {
  a_venir: "menages.statusUpcoming",
  en_cours: "menages.statusInProgress",
  termine: "menages.statusCompleted",
  valide: "menages.statusValidated",
  annule: "menages.statusCancelled",
};

export default function StatusBadge({ status }: { status: MenageStatus }) {
  const { t } = useI18n();
  return <Badge variant={VARIANT[status]}>{t(KEY[status])}</Badge>;
}
