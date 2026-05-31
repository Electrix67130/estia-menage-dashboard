"use client";

import { ReactNode } from "react";
import { Mail, MapPin, Phone, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = "phone" | "email" | "address";

interface Props {
  kind: Kind;
  value: string | null | undefined;
  /** Pour `kind="address"`, valeur multi-lignes affichée; href est dérivé */
  display?: ReactNode;
  className?: string;
}

/**
 * Rend une coordonnée en lien actionnable :
 * - `phone`   → `tel:` (appel)
 * - `email`   → `mailto:` (compose)
 * - `address` → Google Maps directions
 *
 * Si `value` est vide → rend "—" non-interactif.
 */
export default function ContactLink({ kind, value, display, className }: Props) {
  if (!value) return <span className={cn("text-zinc-400", className)}>—</span>;

  const Icon = kind === "phone" ? Phone : kind === "email" ? Mail : MapPin;
  const href = buildHref(kind, value);

  return (
    <a
      href={href}
      target={kind === "address" ? "_blank" : undefined}
      rel={kind === "address" ? "noopener noreferrer" : undefined}
      className={cn(
        "group inline-flex items-center gap-1.5 text-sm text-zinc-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400",
        className,
      )}
    >
      <Icon size={14} className="text-zinc-400 group-hover:text-blue-600" />
      <span className="underline-offset-2 group-hover:underline">{display ?? value}</span>
      {kind === "address" ? (
        <ExternalLink size={12} className="text-zinc-400 group-hover:text-blue-600" />
      ) : null}
    </a>
  );
}

function buildHref(kind: Kind, value: string): string {
  if (kind === "phone") {
    // Nettoie espaces et caractères usuels pour générer un tel: valide
    return `tel:${value.replace(/[\s.()-]/g, "")}`;
  }
  if (kind === "email") {
    return `mailto:${value}`;
  }
  // address → Google Maps directions
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(value)}`;
}
