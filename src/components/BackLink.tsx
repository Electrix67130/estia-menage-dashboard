"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Bouton « retour » contextuel : revient à la page d'origine via l'historique
 * du navigateur (donc calendrier / liste des ménages / vue d'ensemble selon
 * d'où l'utilisateur est arrivé), au lieu d'une destination figée.
 *
 * `fallback` est utilisé uniquement si la page a été ouverte en lien direct
 * (aucun historique de navigation interne — ex. URL partagée, nouvel onglet).
 */
export default function BackLink({
  fallback,
  label = "Retour",
  size = 16,
  className = "flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white",
}: {
  fallback: string;
  label?: string;
  size?: number;
  className?: string;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallback);
    }
  };

  return (
    <button type="button" onClick={handleBack} className={className}>
      <ArrowLeft size={size} />
      {label}
    </button>
  );
}
