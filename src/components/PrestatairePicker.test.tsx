import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EligiblePrestataire } from "@/hooks/useMenageDetail";
import { PrestatairePickerModal } from "./PrestatairePicker";

const eligible: { data: EligiblePrestataire[] | undefined; isLoading: boolean } = { data: [], isLoading: false };
const setPrestas = { mutateAsync: vi.fn(), isPending: false };
const relance = { mutateAsync: vi.fn(), isPending: false };

vi.mock("@/hooks/useMenageDetail", () => ({
  useEligiblePrestataires: () => eligible,
}));
vi.mock("@/hooks/useMenagePrestataires", () => ({
  useSetMenagePrestataires: () => setPrestas,
}));
vi.mock("@/hooks/useMenageResponses", () => ({
  useRelanceMenage: () => relance,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const presta = (id: string, over: Partial<EligiblePrestataire> = {}): EligiblePrestataire => ({
  id,
  first_name: id[0].toUpperCase() + id.slice(1),
  last_name: "Test",
  email: `${id}@e.fr`,
  avatar_url: null,
  is_member: true,
  response_status: null,
  responded_at: null,
  ...over,
});

beforeEach(() => {
  eligible.data = [
    presta("alice", { response_status: "present", responded_at: new Date().toISOString() }),
    presta("bob"),
    presta("carl", { is_member: false }),
    presta("dan", { response_status: "absent", responded_at: new Date().toISOString() }),
  ];
  eligible.isLoading = false;
  setPrestas.mutateAsync.mockResolvedValue([]);
  relance.mutateAsync.mockResolvedValue({ sent: 1 });
});

const open = (currentIds: string[] = [], onClose = vi.fn()) => {
  render(<PrestatairePickerModal menageId="m1" currentIds={currentIds} open onClose={onClose} />);
  return onClose;
};

describe("Modale d'affectation — groupes selon les votes", () => {
  it("range les prestataires en Disponibles / Sans réponse / Indisponibles", () => {
    open();
    expect(screen.getByRole("heading", { name: "Disponibles (1)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sans réponse (2)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Indisponibles (1)" })).toBeInTheDocument();
  });

  it("explique chaque ligne : vote, ancienneté et lien au logement", () => {
    open();
    expect(screen.getByText(/^Présent · à l'instant · membre du logement$/)).toBeInTheDocument();
    expect(screen.getByText("Pas encore répondu · hors logement")).toBeInTheDocument();
    expect(screen.getByText(/^Absent · à l'instant · membre du logement$/)).toBeInTheDocument();
  });

  it("la relance ne vise que les membres du logement sans réponse", async () => {
    const user = userEvent.setup();
    open();
    const btn = screen.getByRole("button", { name: "Relancer les 1" });
    await user.click(btn);
    expect(relance.mutateAsync).toHaveBeenCalledWith("m1");
  });

  it("sans prestataire éligible, invite à ajouter un membre", () => {
    eligible.data = [];
    open();
    expect(screen.getByText(/Aucun prestataire dans ce logement/)).toBeInTheDocument();
  });
});

describe("Modale d'affectation — sélection multiple et référent", () => {
  it("le premier coché devient référent ; le libellé du bouton suit le nombre", async () => {
    const user = userEvent.setup();
    const onClose = open();
    expect(screen.getByRole("button", { name: "Affecter" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: /Bob Test/ }));
    expect(screen.getByRole("button", { name: "Affecter 1 prestataire" })).toBeEnabled();
    const bobRow = screen.getByRole("checkbox", { name: /Bob Test/ }).closest("label")!;
    expect(within(bobRow).getByText("Référent")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /Alice Test/ }));
    expect(screen.getByRole("button", { name: "Affecter 2 prestataires" })).toBeInTheDocument();
    const aliceRow = screen.getByRole("checkbox", { name: /Alice Test/ }).closest("label")!;
    expect(within(aliceRow).queryByText("Référent")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Affecter 2 prestataires" }));
    expect(setPrestas.mutateAsync).toHaveBeenCalledWith(["bob", "alice"]);
    expect(onClose).toHaveBeenCalled();
  });

  it("décocher le référent passe le relais au suivant", async () => {
    const user = userEvent.setup();
    open(["bob", "alice"]);
    await user.click(screen.getByRole("checkbox", { name: /Bob Test/ }));
    const aliceRow = screen.getByRole("checkbox", { name: /Alice Test/ }).closest("label")!;
    expect(within(aliceRow).getByText("Référent")).toBeInTheDocument();
  });

  it("tout décocher propose de retirer les prestataires", async () => {
    const user = userEvent.setup();
    open(["bob"]);
    await user.click(screen.getByRole("checkbox", { name: /Bob Test/ }));
    const btn = screen.getByRole("button", { name: "Retirer les prestataires" });
    expect(btn).toBeEnabled();
    await user.click(btn);
    expect(setPrestas.mutateAsync).toHaveBeenCalledWith([]);
  });
});
