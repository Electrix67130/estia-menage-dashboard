import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import { apiFetch } from "@/lib/api";
import { renderWithQuery } from "@/test/query";
import { menage, paginated, reschedule, user } from "@/test/fixtures";
import type { User } from "@/types/api";
import DashboardPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
const authState: { user: User | null } = { user: null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));

const items = () => [
  menage({ id: "a", date_prevue: "2026-10-05", status: "a_venir", logement_name: "Villa Rosa" }),
  menage({ id: "b", date_prevue: "2026-10-07", status: "en_cours", logement_name: "Loft Bleu" }),
  menage({ id: "c", date_prevue: "2026-10-06", prestation_type: "check_in", logement_name: "Chalet Vert" }),
  menage({ id: "d", date_prevue: "2026-10-09", prestation_type: "check_out", logement_name: "Mas Jaune" }),
  menage({ id: "e", date_prevue: "2026-10-02", status: "valide", logement_name: "Studio Gris" }),
  menage({ id: "f", date_prevue: "2026-10-08", status: "annule", logement_name: "Cabane Rouge" }),
  menage({ id: "g", date_prevue: "2026-09-28", status: "a_venir", logement_name: "Passé Oublié" }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 10));
  authState.user = user({ id: "admin-1", first_name: "Julien", role: "admin" });
  vi.mocked(apiFetch).mockImplementation(async (path: string): Promise<unknown> => {
    if (path === "/menages?limit=200") return paginated(items());
    if (path === "/menages?unassigned=true&limit=1") return { data: [], meta: { total: 3, page: 1, limit: 1, totalPages: 3 } };
    if (path.startsWith("/reschedule-requests")) return paginated([reschedule({ id: "r1", menage_id: "a" })]);
    throw new Error(`Route non mockée : ${path}`);
  });
});

afterEach(() => vi.useRealTimers());

const stat = (label: string) => screen.getByText(label).nextElementSibling;

describe("Vue d'ensemble", () => {
  it("salue l'utilisateur et compte les prestations à venir par type, sans mélanger ménages et check-in/out", async () => {
    renderWithQuery(
      <I18nProvider>
        <DashboardPage />
      </I18nProvider>,
    );
    expect(await screen.findByText("Bonjour Julien 👋")).toBeInTheDocument();
    await screen.findByText("Villa Rosa");
    expect(stat("Ménages à venir")).toHaveTextContent("2");
    expect(stat("Check-in à venir")).toHaveTextContent("1");
    expect(stat("Check-out à venir")).toHaveTextContent("1");
    expect(stat("Non assignés")).toHaveTextContent("3");
    expect(stat("Reschedule en attente")).toHaveTextContent("1");
    expect(stat("Validés ce mois")).toHaveTextContent("1");
  });

  it("liste les prochaines prestations par date, sans les annulées ni le passé", async () => {
    renderWithQuery(
      <I18nProvider>
        <DashboardPage />
      </I18nProvider>,
    );
    await screen.findByText("Villa Rosa");
    const list = screen.getByRole("heading", { name: "Prochaines prestations" }).parentElement!.parentElement!;
    const names = within(list).getAllByRole("listitem").map((li) => li.textContent);
    expect(names.map((n) => n?.match(/Villa Rosa|Loft Bleu|Chalet Vert|Mas Jaune|Studio Gris|Cabane Rouge|Passé Oublié/)?.[0])).toEqual([
      "Villa Rosa",
      "Chalet Vert",
      "Loft Bleu",
      "Mas Jaune",
    ]);
    expect(within(list).getByText("Check-in")).toBeInTheDocument();
    expect(within(list).getByText("Check-out")).toBeInTheDocument();
  });

  it("le prestataire n'a ni bouton de création ni raccourcis admin", async () => {
    authState.user = user({ id: "paul", first_name: "Paul", role: "prestataire" });
    renderWithQuery(
      <I18nProvider>
        <DashboardPage />
      </I18nProvider>,
    );
    await screen.findByText("Villa Rosa");
    expect(screen.queryByRole("link", { name: /Nouveau ménage/ })).toBeNull();
    expect(screen.queryByText("Raccourcis admin")).toBeNull();
  });
});
