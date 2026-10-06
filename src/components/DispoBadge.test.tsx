import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DispoBadge, { dispoLabel, dispoState, type DispoCounts } from "./DispoBadge";

const counts = (over: Partial<DispoCounts>): DispoCounts => ({
  present_count: 0,
  absent_count: 0,
  member_prestataire_count: 0,
  ...over,
});

describe("« Qui est dispo ? » — état d'une prestation sans prestataire", () => {
  it("un seul « Présent » suffit à rendre la prestation disponible, même avec des absents", () => {
    expect(dispoState(counts({ present_count: 1, absent_count: 5 }))).toBe("available");
  });

  it("que des « Absent » → personne de dispo", () => {
    expect(dispoState(counts({ absent_count: 2, member_prestataire_count: 3 }))).toBe("unavailable");
  });

  it("aucune réponse tant que personne n'a voté", () => {
    expect(dispoState(counts({ member_prestataire_count: 3 }))).toBe("no_response");
    expect(dispoState(counts({}))).toBe("no_response");
  });

  it("libellés accordés en nombre", () => {
    expect(dispoLabel(counts({ present_count: 1 }))).toBe("1 dispo");
    expect(dispoLabel(counts({ present_count: 3 }))).toBe("3 dispos");
    expect(dispoLabel(counts({ absent_count: 1 }))).toBe("Personne de dispo");
    expect(dispoLabel(counts({}))).toBe("Aucune réponse");
  });
});

describe("DispoBadge (rendu)", () => {
  it("disponible : pastille teal, pas de détail", () => {
    render(<DispoBadge menage={counts({ present_count: 2 })} />);
    const pill = screen.getByText("2 dispos");
    expect(pill).toHaveClass("text-teal-700");
    expect(screen.queryByText(/membre|absent/)).toBeNull();
  });

  it("indisponible : pastille rose + nombre d'absents", () => {
    render(<DispoBadge menage={counts({ absent_count: 3 })} />);
    expect(screen.getByText("Personne de dispo")).toHaveClass("text-rose-700");
    expect(screen.getByText("3 absents")).toBeInTheDocument();
  });

  it("sans réponse : pastille grise + nombre de membres pouvant répondre", () => {
    render(<DispoBadge menage={counts({ member_prestataire_count: 1 })} />);
    expect(screen.getByText("Aucune réponse")).toHaveClass("text-zinc-600");
    expect(screen.getByText("1 membre")).toBeInTheDocument();
  });

  it("en mode compact (chips du planning), le détail est masqué", () => {
    render(<DispoBadge menage={counts({ absent_count: 2 })} compact />);
    expect(screen.getByText("Personne de dispo")).toBeInTheDocument();
    expect(screen.queryByText("2 absents")).toBeNull();
  });
});
