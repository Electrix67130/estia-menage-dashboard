import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { MenageStatus } from "@/types/api";
import StatusBadge from "./StatusBadge";

const cases: [MenageStatus, string, string][] = [
  ["a_venir", "À venir", "text-blue-700"],
  ["en_cours", "En cours", "text-amber-700"],
  ["termine", "Terminé", "text-teal-700"],
  ["valide", "Validé", "text-teal-700"],
  ["annule", "Annulé", "text-rose-700"],
];

describe("StatusBadge", () => {
  it.each(cases)("statut %s → « %s », couleur %s", (status, label, cls) => {
    render(
      <I18nProvider>
        <StatusBadge status={status} />
      </I18nProvider>,
    );
    expect(screen.getByText(label)).toHaveClass(cls);
  });

  it("suit la langue mémorisée", () => {
    window.localStorage.setItem("estia-menage_locale", "en");
    render(
      <I18nProvider>
        <StatusBadge status="a_venir" />
      </I18nProvider>,
    );
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });
});
