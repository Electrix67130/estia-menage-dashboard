import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { renderWithQuery } from "@/test/query";
import { menage, paginated, reschedule, user } from "@/test/fixtures";
import type { User } from "@/types/api";
import PrestationsListPage from "./PrestationsListPage";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
const authState: { user: User | null } = { user: null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));
const confirmMock = vi.fn();
vi.mock("@/contexts/DialogContext", () => ({
  useDialog: () => ({ confirm: confirmMock, alert: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// La carte Leaflet n'a rien à faire dans jsdom.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MapStub({ menages }: { menages: unknown[] }): ReactNode {
      return <div data-testid="map-stub">{menages.length}</div>;
    },
}));

const admin = user({ id: "admin-1", first_name: "Admin", last_name: "Root", role: "admin" });
const paul = user({ id: "paul", first_name: "Paul", last_name: "Martin" });

// Aujourd'hui : lundi 5 octobre 2026, 10h (Paris).
const TODAY = new Date(2026, 9, 5, 10, 0, 0);

const fixtures = () => [
  menage({ id: "m-today", date_prevue: "2026-10-05", horaire_prevu: "10:00:00", logement_name: "Villa Rosa",
    prestataire_user_id: "paul", prestataire_first_name: "Paul", prestataire_last_name: "Martin" }),
  menage({ id: "m-dispo", date_prevue: "2026-10-06", logement_id: "l2", logement_name: "Loft Bleu", logement_city: "Lyon",
    present_count: 1, member_prestataire_count: 2 }),
  menage({ id: "m-silence", date_prevue: "2026-10-08", logement_name: "Chalet Vert", member_prestataire_count: 2 }),
  menage({ id: "m-late", date_prevue: "2026-10-01", logement_name: "Mas Jaune", needs_attention: true,
    prestataire_user_id: "paul", prestataire_first_name: "Paul", prestataire_last_name: "Martin" }),
  menage({ id: "m-done", date_prevue: "2026-10-03", logement_name: "Studio Gris", status: "termine",
    departed_at: "2026-10-03T12:00:00+02:00", prestataire_user_id: "paul", prestataire_first_name: "Paul", prestataire_last_name: "Martin" }),
  menage({ id: "m-ical", date_prevue: "2026-10-10", logement_name: "Cabane Rouge", external_source: "cal_airbnb", created_by: null,
    prestataire_user_id: "paul", prestataire_first_name: "Paul", prestataire_last_name: "Martin" }),
];

const state = {
  menages: fixtures(),
  reschedules: [reschedule({ id: "r1", menage_id: "m-today", reason: "Médecin" })],
  unread: { by_menage: {} as Record<string, number>, by_organization: {}, by_type: {} as Record<string, number> },
};

const apiFetchMock = vi.mocked(apiFetch);
const calls = () => apiFetchMock.mock.calls.map(([path]) => path);

function routeApi() {
  apiFetchMock.mockImplementation(async (path: string, opts): Promise<unknown> => {
    if (path.startsWith("/menages?")) return paginated(state.menages);
    if (path.startsWith("/reschedule-requests")) return paginated(state.reschedules);
    if (path.startsWith("/users")) return paginated([admin, paul]);
    if (path.startsWith("/logements")) return paginated([
      { id: "l1", name: "Villa Rosa", archived_at: null },
      { id: "l2", name: "Loft Bleu", archived_at: null },
      { id: "l3", name: "Archivé", archived_at: "2026-01-01" },
    ]);
    if (path === "/menage-views/unread-summary") return state.unread;
    if (path.endsWith("/eligible-prestataires")) return { data: [] };
    if (path.endsWith("/relance")) return { sent: 2 };
    if (path.includes("/decide")) return state.reschedules[0];
    if (path.endsWith("/validate")) return {};
    throw new Error(`Route non mockée : ${opts?.method ?? "GET"} ${path}`);
  });
}

/** Cartes-liens d'une prestation portant ce nom de logement (hors options de filtre). */
const cards = (name: string) =>
  screen
    .queryAllByText(name)
    .map((el) => el.closest<HTMLElement>('a[href^="/menages/"]'))
    .filter((el): el is HTMLElement => el !== null);
const card = (name: string) => {
  const found = cards(name);
  if (found.length !== 1) throw new Error(`${found.length} carte(s) « ${name} » au lieu d'une`);
  return found[0];
};

async function renderPage(type: "menage" | "check_in" | "check_out" = "menage") {
  const utils = renderWithQuery(<PrestationsListPage prestationType={type} />);
  await screen.findByRole("heading", { level: 2, name: "Aujourd'hui" });
  return utils;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(TODAY);
  authState.user = admin;
  confirmMock.mockResolvedValue(true);
  state.menages = fixtures();
  state.reschedules = [reschedule({ id: "r1", menage_id: "m-today", reason: "Médecin" })];
  state.unread = { by_menage: {}, by_organization: {}, by_type: {} };
  routeApi();
});

afterEach(() => {
  vi.useRealTimers();
});

const gotoTodo = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole("button", { name: /À traiter/ }));
};

describe("Liste des prestations — vue Planning", () => {
  it("regroupe par jour : Aujourd'hui (avec la date) puis À venir ; le passé non traité n'y figure pas", async () => {
    await renderPage();
    const today = screen.getByRole("heading", { level: 2, name: "Aujourd'hui" }).closest("section")!;
    expect(within(today.querySelector("header")!).getByText("lundi 5 octobre 2026")).toBeInTheDocument();
    expect(within(today).getByText("Villa Rosa")).toBeInTheDocument();

    const upcoming = screen.getByRole("heading", { level: 2, name: "À venir" }).closest("section")!;
    expect(within(upcoming).getByText("Loft Bleu")).toBeInTheDocument();
    expect(within(upcoming).getByText("Chalet Vert")).toBeInTheDocument();
    expect(within(upcoming).getByText("Cabane Rouge")).toBeInTheDocument();

    // Non pointée (1er octobre) et terminée (3 octobre) : dans « À traiter », pas ici.
    expect(cards("Mas Jaune")).toHaveLength(0);
    expect(cards("Studio Gris")).toHaveLength(0);
  });

  it("résume la journée en chiffres : aujourd'hui, en cours, non assignées, non pointées", async () => {
    await renderPage();
    const cell = (label: string) => screen.getByText(label).previousElementSibling;
    expect(cell("aujourd'hui")).toHaveTextContent("1");
    expect(cell("en cours")).toHaveTextContent("0");
    expect(cell("non assignées")).toHaveTextContent("2");
    expect(cell("non pointée")).toHaveTextContent("1");
  });

  it("ne demande à l'API que la worklist active du type affiché (closed=false)", async () => {
    await renderPage("check_in");
    const url = calls().find((p) => p.startsWith("/menages?"))!;
    const qs = new URLSearchParams(url.split("?")[1]);
    expect(qs.get("type")).toBe("check_in");
    expect(qs.get("closed")).toBe("false");
    expect(qs.get("unassigned")).toBeNull();
  });

  it("une prestation sans prestataire affiche le badge « Qui est dispo ? » et l'action adaptée", async () => {
    await renderPage();
    const dispo = card("Loft Bleu");
    expect(within(dispo).getByText("1 dispo")).toBeInTheDocument();
    expect(within(dispo).getByRole("button", { name: "Affecter" })).toBeInTheDocument();

    const silence = card("Chalet Vert");
    expect(within(silence).getByText("Aucune réponse")).toBeInTheDocument();
    expect(within(silence).getByText("2 membres")).toBeInTheDocument();
    expect(within(silence).getByRole("button", { name: "Relancer" })).toBeInTheDocument();
  });

  it("« Relancer » pousse une relance à la prestation, sans quitter la liste", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Relancer" }));
    await waitFor(() => expect(calls()).toContain("/menages/m-silence/relance"));
  });

  it("« Affecter » ouvre la modale d'affectation de cette prestation", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Affecter" }));
    expect(await screen.findByRole("heading", { name: "Affecter des prestataires" })).toBeInTheDocument();
    await waitFor(() => expect(calls()).toContain("/menages/m-dispo/eligible-prestataires"));
  });
});

describe("Liste des prestations — vue À traiter", () => {
  it("compte sur l'onglet tout ce qui attend l'admin", async () => {
    await renderPage();
    // 1 à valider + 1 non pointée + 2 sans prestataire + 1 demande de report.
    expect(screen.getByRole("button", { name: /À traiter/ })).toHaveTextContent("5");
  });

  it("sépare À valider, Non pointée, Sans prestataire (dispo / personne) et Demande de report", async () => {
    const user = userEvent.setup();
    await renderPage();
    await gotoTodo(user);

    const section = (name: RegExp) => screen.getByRole("heading", { level: 2, name }).closest("section")!;
    expect(within(section(/^À valider$/)).getByText("Studio Gris")).toBeInTheDocument();
    expect(within(section(/^À valider$/)).getByText("Terminé le 03/10/2026 12:00")).toBeInTheDocument();
    expect(within(section(/^Non pointée$/)).getByText("Mas Jaune")).toBeInTheDocument();
    expect(within(section(/quelqu'un est dispo/)).getByText("Loft Bleu")).toBeInTheDocument();
    expect(within(section(/personne de dispo/)).getByText("Chalet Vert")).toBeInTheDocument();
    expect(within(section(/^Demande de report$/)).getByText("Paul Martin")).toBeInTheDocument();
  });

  it("« Non pointé » remplace le statut sur une prestation dont le jour est passé sans arrivée", async () => {
    const user = userEvent.setup();
    await renderPage();
    await gotoTodo(user);
    const late = card("Mas Jaune");
    expect(within(late).getByText("Non pointé")).toBeInTheDocument();
    expect(within(late).queryByText("À venir")).toBeNull();
    expect(within(late).getByText(/Jour passé sans pointage/)).toBeInTheDocument();
  });

  it("une demande de report annonce qui propose quoi, et Accepter l'applique à la prestation", async () => {
    const user = userEvent.setup();
    await renderPage();
    await gotoTodo(user);
    const section = screen.getByRole("heading", { level: 2, name: "Demande de report" }).closest("section")!;
    expect(within(section).getByText("mercredi 7 octobre 2026 à 14:30")).toBeInTheDocument();
    expect(within(section).getByText(/« Médecin »/)).toBeInTheDocument();

    await user.click(within(section).getByRole("button", { name: "Accepter" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/reschedule-requests/r1/decide", {
        method: "POST",
        body: { decision: "approved", decision_reason: undefined, apply_to_menage: true },
      }),
    );
  });

  it("Refuser n'applique rien à la prestation", async () => {
    const user = userEvent.setup();
    await renderPage();
    await gotoTodo(user);
    await user.click(screen.getByRole("button", { name: "Refuser" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/reschedule-requests/r1/decide", {
        method: "POST",
        body: { decision: "rejected", decision_reason: undefined, apply_to_menage: false },
      }),
    );
  });

  it("« Tout valider » ne valide que les terminées, après confirmation", async () => {
    const user = userEvent.setup();
    await renderPage();
    await gotoTodo(user);
    await user.click(screen.getByRole("button", { name: "Tout valider" }));
    expect(confirmMock).toHaveBeenCalledWith(expect.objectContaining({ title: "Valider 1 ménage ?" }));
    await waitFor(() => expect(calls().filter((p) => p.endsWith("/validate"))).toEqual(["/menages/m-done/validate"]));
  });

  it("une confirmation refusée n'appelle pas l'API", async () => {
    confirmMock.mockResolvedValue(false);
    const user = userEvent.setup();
    await renderPage();
    await gotoTodo(user);
    await user.click(screen.getByRole("button", { name: "Tout valider" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(calls().some((p) => p.endsWith("/validate"))).toBe(false);
  });

  it("affiche « Tout est à jour » quand rien n'attend", async () => {
    state.menages = [fixtures()[0]];
    state.reschedules = [];
    const user = userEvent.setup();
    await renderPage();
    await gotoTodo(user);
    expect(screen.getByText("Tout est à jour")).toBeInTheDocument();
  });
});

describe("Liste des prestations — filtres mémorisés", () => {
  const openFilters = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /^Filtres/ }));
  };

  it("le filtre Créateur range les prestations iCal sous « Airbnb », les autres sous « Manuel » ou leur auteur", async () => {
    const user = userEvent.setup();
    await renderPage();
    await openFilters(user);
    const select = screen.getByRole("combobox", { name: "Filtrer par créateur" });
    const labels = within(select).getAllByRole("option").map((o) => o.textContent);
    expect(labels).toEqual(["Tous les créateurs", "Manuel", "Airbnb", "Admin Root"]);

    await user.selectOptions(select, "src:cal_airbnb");
    expect(cards("Cabane Rouge")).toHaveLength(1);
    expect(cards("Villa Rosa")).toHaveLength(0);
  });

  it("un filtre actif est signalé (compteur sur « Filtres », Réinitialiser actif) et mémorisé", async () => {
    const user = userEvent.setup();
    await renderPage();
    const reset = screen.getByRole("button", { name: "Réinitialiser" });
    expect(reset).toBeDisabled();
    await openFilters(user);

    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrer par logement" }), "l2");
    expect(screen.getByRole("button", { name: /^Filtres/ })).toHaveTextContent("1");
    expect(reset).toBeEnabled();
    expect(cards("Loft Bleu")).toHaveLength(1);
    expect(cards("Villa Rosa")).toHaveLength(0);
    await waitFor(() => expect(window.localStorage.getItem("menages.filter.logement")).toBe('"l2"'));

    await user.click(reset);
    expect(cards("Villa Rosa")).toHaveLength(1);
    expect(reset).toBeDisabled();
  });

  it("les logements archivés ne sont pas proposés dans le filtre", async () => {
    const user = userEvent.setup();
    await renderPage();
    await openFilters(user);
    const select = screen.getByRole("combobox", { name: "Filtrer par logement" });
    expect(within(select).queryByRole("option", { name: "Archivé" })).toBeNull();
  });

  it("« Non assigné » dans le filtre prestataire interroge l'API avec unassigned=true", async () => {
    const user = userEvent.setup();
    await renderPage();
    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrer par prestataire" }), "__unassigned__");
    await waitFor(() => {
      const url = calls().filter((p) => p.startsWith("/menages?")).at(-1)!;
      expect(new URLSearchParams(url.split("?")[1]).get("unassigned")).toBe("true");
    });
  });

  it("le filtre de disponibilité est transmis tel quel à l'API", async () => {
    const user = userEvent.setup();
    await renderPage();
    await openFilters(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrer par disponibilité des prestataires" }),
      "available",
    );
    await waitFor(() => {
      const url = calls().filter((p) => p.startsWith("/menages?")).at(-1)!;
      expect(new URLSearchParams(url.split("?")[1]).get("availability")).toBe("available");
    });
  });

  it("anti « badge fantôme » : une prestation avec du nouveau masquée par un filtre est remontée en tête", async () => {
    state.unread = { by_menage: { "m-ical": 2 }, by_organization: {}, by_type: { menage: 2 } };
    const user = userEvent.setup();
    await renderPage();
    expect(screen.queryByText(/masquée par tes filtres/)).toBeNull();

    await openFilters(user);
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrer par logement" }), "l2");
    const banner = await screen.findByText("1 prestation avec du nouveau est masquée par tes filtres");
    const box = banner.closest("div")!.parentElement!;
    expect(within(box).getByText(/Cabane Rouge/)).toBeInTheDocument();
    expect(within(box).getByRole("link")).toHaveAttribute("href", "/menages/m-ical");

    await user.click(within(box).getByRole("button", { name: "Réinitialiser les filtres" }));
    expect(screen.queryByText(/masquée par tes filtres/)).toBeNull();
  });

  it("la recherche texte filtre sur logement, ville et prestataire", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByPlaceholderText("Logement, ville, prestataire…"), "lyon");
    expect(cards("Loft Bleu")).toHaveLength(1);
    expect(cards("Villa Rosa")).toHaveLength(0);

    await user.clear(screen.getByPlaceholderText("Logement, ville, prestataire…"));
    await user.type(screen.getByPlaceholderText("Logement, ville, prestataire…"), "martin");
    expect(cards("Villa Rosa")).toHaveLength(1);
    expect(cards("Chalet Vert")).toHaveLength(0);
  });
});

describe("Liste des prestations — côté prestataire", () => {
  it("pas de création, pas de sélection groupée, filtres réduits au logement", async () => {
    authState.user = paul;
    const user = userEvent.setup();
    await renderPage();
    expect(screen.queryByRole("link", { name: /Nouveau ménage/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sélectionner/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Filtres/ }));
    expect(screen.getByRole("combobox", { name: "Filtrer par logement" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Filtrer par prestataire" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Filtrer par créateur" })).toBeNull();
  });

  it("la carte d'une prestation sans prestataire n'offre ni Affecter ni Relancer", async () => {
    authState.user = paul;
    await renderPage();
    expect(screen.queryByRole("button", { name: "Affecter" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Relancer" })).toBeNull();
  });
});

describe("Liste des prestations — vue carte", () => {
  it("bascule sur la carte avec les prestations filtrées", async () => {
    const user = userEvent.setup();
    await renderPage();
    await user.click(screen.getByRole("button", { name: "Vue carte" }));
    expect(screen.getByTestId("map-stub")).toHaveTextContent("6");
  });
});
