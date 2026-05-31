import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDateFr } from "./date-fr";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date?: string | null) {
  return formatDateFr(date, "long") || "—";
}

export function formatDateTime(date?: string | null) {
  return formatDateFr(date, "datetime") || "—";
}

export function initials(firstName?: string, lastName?: string) {
  const a = firstName?.[0] ?? "";
  const b = lastName?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}
