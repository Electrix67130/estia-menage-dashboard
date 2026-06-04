"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

/**
 * Lightbox photo standardisée pour le dashboard. Utilisée partout où une image
 * peut être agrandie pour assurer une UX cohérente (overlay sombre, X en haut
 * à droite, fermeture au clic backdrop ou touche Échap).
 *
 * Pour ajouter des métadonnées (timestamp, géo, actions), passer un `footer`.
 */
export default function PhotoLightbox({
  open,
  onClose,
  photoUrl,
  title,
  subtitle,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  photoUrl: string | null;
  title?: string;
  subtitle?: string;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !photoUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/92 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {title ? (
            <h2 className="truncate text-base font-semibold text-white">{title}</h2>
          ) : null}
          {subtitle ? (
            <p className="mt-0.5 text-sm text-white/70">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
          aria-label="Fermer"
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="flex flex-1 items-center justify-center overflow-hidden py-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={title ?? ""}
          className="max-h-full max-w-full object-contain"
        />
      </div>
      {footer ? (
        <div onClick={(e) => e.stopPropagation()} className="flex flex-col gap-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
