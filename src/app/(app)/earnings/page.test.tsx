import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { renderWithQuery } from "@/test/query";
import { user } from "@/test/fixtures";
import type { User } from "@/types/api";
import EarningsPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
const authState: { user: User | null } = { user: null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));

const apiFetchMock = vi.mocked(apiFetch);
const calls = () => apiFetchMock.mock.calls.map(([p]) => p);

/** Valeur d'une carte de synthèse, repérée par son libellé (espaces insécables normalisées). */
const cardValue = (label: RegExp) =>
  screen.getByText(label).nextElementSibling?.textContent?.replace(/\s/g, " ");

const earnings = {
  total: 700,
  revenue: 1200,
  margin: 500,
  currency: "EUR",
  count: 3,
  from: "2026-10-01",
  to: "2026-10-31",
  by_client: [
    { id: "c1", name: "Dupont SARL", total: 400, count: 2, revenue: 800, margin: 400 },
    { id: "__no_client__", name: "Sans client", total: 300, count: 1, revenue: 400, margin: 100 },
  ],
  by_prestataire: [{ id: "paul", name: "Paul Martin", total: 700, count: 3 }],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 10));
  authState.user = user({ id: "admin-1", role: "admin" });
  apiFetchMock.mockImplementation(async (path: string): Promise<unknown> => {
    if (path.startsWith("/admin/earnings")) return earnings;
    if (path.startsWith("/users/paul/earnings"))
      return {
        total: 700,
        currency: "EUR",
        count: 1,
        items: [
          { id: "x", date_prevue: "2026-10-02", logement_id: "l1", logement_name: "Villa Rosa", prestation_type: "menage", status: "valide", subtotal: 700, validated_at: null },
        ],
      };
    throw new Error(`Route non mockée : ${path}`);
  });
});

afterEach(() => vi.useRealTimers());

describe("Gains (admin)", () => {
  it("affiche CA client, coût prestataire et marge (CA − coût) tels que calculés par l'API", async () => {
    renderWithQuery(<EarningsPage />);
    await screen.findByText("3 ménages sur la période");
    expect(cardValue(/CA client \(HT\)/)).toBe("1 200,00 €");
    expect(cardValue(/coût prestataire/)).toBe("700,00 €");
    expect(cardValue(/^Marge \(CA − coût\)$/)).toBe("500,00 €");
  });

  it("interroge le mois courant par défaut et propose « Facturer » par client (sauf « sans client »)", async () => {
    renderWithQuery(<EarningsPage />);
    await screen.findByText("Dupont SARL");
    expect(calls()[0]).toBe("/admin/earnings?from=2026-10-01&to=2026-10-31");
    expect(screen.getByText("octobre 2026")).toBeInTheDocument();

    const links = screen.getAllByRole("link", { name: /Facturer/ });
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/invoices?create=1&client_id=c1&from=2026-10-01&to=2026-10-31");
  });

  it("navigue de période en période et « Tout » retire les bornes", async () => {
    const u = userEvent.setup();
    renderWithQuery(<EarningsPage />);
    await screen.findByText("Dupont SARL");

    await u.click(screen.getByRole("button", { name: "Période précédente" }));
    await waitFor(() => expect(calls()).toContain("/admin/earnings?from=2026-09-01&to=2026-09-30"));
    expect(screen.getByText("septembre 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aujourd'hui" })).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Tout" }));
    await waitFor(() => expect(calls()).toContain("/admin/earnings"));
  });

  it("la semaine va du lundi au dimanche", async () => {
    const u = userEvent.setup();
    renderWithQuery(<EarningsPage />);
    await screen.findByText("Dupont SARL");
    await u.click(screen.getByRole("button", { name: "Semaine" }));
    await waitFor(() => expect(calls()).toContain("/admin/earnings?from=2026-10-05&to=2026-10-11"));
  });

  it("cliquer un prestataire ouvre le détail de ce qu'on lui doit", async () => {
    const u = userEvent.setup();
    renderWithQuery(<EarningsPage />);
    await u.click(await screen.findByRole("button", { name: /Paul Martin/ }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Paul Martin" })).toBeInTheDocument();
    await within(dialog).findByText("vendredi 2 octobre 2026");
    expect(within(dialog).getByText((c) => c.replace(/\s/g, " ") === "1 prestation · à payer 700,00 €")).toBeInTheDocument();
    expect(calls()).toContain("/users/paul/earnings?from=2026-10-01&to=2026-10-31");
  });

  it("est réservée aux administrateurs", () => {
    authState.user = user({ id: "p", role: "prestataire" });
    renderWithQuery(<EarningsPage />);
    expect(screen.getByText("Accès réservé aux administrateurs.")).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });
});
