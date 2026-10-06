import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { renderWithQuery } from "@/test/query";
import { menage, paginated, user } from "@/test/fixtures";
import type { User } from "@/types/api";
import ArchivesPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
const authState: { user: User | null } = { user: null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));

const apiFetchMock = vi.mocked(apiFetch);
const menagesQuery = () => {
  const url = apiFetchMock.mock.calls.map(([p]) => p).filter((p) => p.startsWith("/menages?")).at(-1)!;
  return new URLSearchParams(url.split("?")[1]);
};

const closed = () => [
  menage({ id: "m-v", date_prevue: "2026-10-02", status: "valide", logement_name: "Villa Rosa",
    prestataire_user_id: "paul", prestataire_first_name: "Paul", prestataire_last_name: "Martin" }),
  menage({ id: "m-a", date_prevue: "2026-10-01", status: "annule", logement_name: "Loft Bleu" }),
  menage({ id: "m-s", date_prevue: "2026-09-01", status: "a_venir", logement_name: "Mas Jaune" }),
  menage({ id: "m-t", date_prevue: "2026-10-03", status: "termine", logement_name: "Studio Gris" }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 10));
  authState.user = user({ id: "admin-1", role: "admin" });
  apiFetchMock.mockImplementation(async (path: string): Promise<unknown> => {
    if (path.startsWith("/menages?")) return paginated(closed());
    if (path.startsWith("/users")) return paginated([user({ id: "paul", first_name: "Paul", last_name: "Martin" })]);
    if (path.startsWith("/logements")) return paginated([{ id: "l1", name: "Villa Rosa", archived_at: null }]);
    throw new Error(`Route non mockée : ${path}`);
  });
});

afterEach(() => vi.useRealTimers());

const rows = () => screen.getAllByRole("listitem");

describe("Historique (archives) — requête", () => {
  it("demande les clôturées du mois + les oubliées de plus de 30 jours (stale_before)", async () => {
    renderWithQuery(<ArchivesPage />);
    await screen.findByText("4 ménages clôturés");
    const qs = menagesQuery();
    expect(qs.get("closed")).toBe("true");
    expect(qs.get("stale_before")).toBe("2026-09-05");
    expect(qs.get("from")).toBe("2026-10-01");
    expect(qs.get("to")).toBe("2026-10-31");
    expect(qs.get("limit")).toBe("500");
    expect(qs.get("assigned")).toBeNull();
  });

  it("un prestataire ne voit que ce qu'il a réellement fait (assigned=me) et pas le filtre prestataire", async () => {
    authState.user = user({ id: "paul", role: "prestataire" });
    renderWithQuery(<ArchivesPage />);
    await screen.findByText("4 ménages clôturés");
    expect(menagesQuery().get("assigned")).toBe("me");
    expect(screen.queryByRole("combobox", { name: "Filtrer par prestataire" })).toBeNull();
  });

  it("« Tout » retire les bornes de période", async () => {
    const u = userEvent.setup();
    renderWithQuery(<ArchivesPage />);
    await screen.findByText("4 ménages clôturés");
    await u.click(screen.getByRole("button", { name: "Tout" }));
    await waitFor(() => {
      const qs = menagesQuery();
      expect(qs.get("from")).toBeNull();
      expect(qs.get("to")).toBeNull();
    });
  });
});

describe("Historique (archives) — liste", () => {
  it("étiquette Validé / Annulé / Non traitée (à valider ou jamais pointée), du plus récent au plus ancien", async () => {
    renderWithQuery(<ArchivesPage />);
    await screen.findByText("4 ménages clôturés");
    const items = rows();
    expect(items.map((li) => within(li).getByRole("link").textContent)).toEqual([
      expect.stringContaining("Studio Gris"),
      expect.stringContaining("Villa Rosa"),
      expect.stringContaining("Loft Bleu"),
      expect.stringContaining("Mas Jaune"),
    ]);
    expect(within(items[0]).getByText("Non traitée · à valider")).toBeInTheDocument();
    expect(within(items[1]).getByText("Validé")).toBeInTheDocument();
    expect(within(items[1]).getByText("Paul Martin")).toBeInTheDocument();
    expect(within(items[2]).getByText("Annulé")).toBeInTheDocument();
    expect(within(items[2]).getByText("Non assigné")).toBeInTheDocument();
    expect(within(items[3]).getByText("Non traitée · jamais pointée")).toBeInTheDocument();
  });

  it("le filtre « Non traitées » ne garde que les oubliées", async () => {
    const u = userEvent.setup();
    renderWithQuery(<ArchivesPage />);
    await screen.findByText("4 ménages clôturés");
    await u.click(screen.getByRole("button", { name: "Non traitées" }));
    expect(rows()).toHaveLength(2);
    expect(screen.getByText("2 ménages clôturés")).toBeInTheDocument();
    expect(rows().some((li) => li.textContent?.includes("Villa Rosa"))).toBe(false);
  });

  it("la recherche texte filtre sur le logement ou le prestataire", async () => {
    const u = userEvent.setup();
    renderWithQuery(<ArchivesPage />);
    await screen.findByText("4 ménages clôturés");
    await u.type(screen.getByPlaceholderText("Logement, ville, prestataire…"), "paul");
    expect(rows()).toHaveLength(1);
    expect(screen.getByText("1 ménage clôturé")).toBeInTheDocument();
  });

  it("état vide explicite", async () => {
    apiFetchMock.mockImplementation(async (path: string): Promise<unknown> =>
      path.startsWith("/menages?") ? paginated([]) : paginated([]),
    );
    renderWithQuery(<ArchivesPage />);
    expect(await screen.findByText("Aucun ménage archivé")).toBeInTheDocument();
    expect(screen.getByText(/plus de 30 jours jamais traitées/)).toBeInTheDocument();
  });
});
