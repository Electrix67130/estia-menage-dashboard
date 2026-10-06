import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientReport, ReportMenage } from "@/hooks/useClients";
import { user } from "@/test/fixtures";
import type { Client, User } from "@/types/api";
import ClientReportPage from "./page";

const authState: { user: User | null } = { user: null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));
const reportState: { data: ClientReport | undefined; isLoading: boolean } = { data: undefined, isLoading: false };
vi.mock("@/hooks/useClients", () => ({ useClientReport: () => reportState }));

const client: Client = {
  id: "c1", organization_id: "org", created_by: null, first_name: null, last_name: null, company_name: "Dupont SARL",
  email: null, phone: null, billing_address: null, postal_code: null, city: null, country: "FR", siret: null, vat_number: null,
  notes: null, archived_at: null, created_at: "", updated_at: "",
};

const row = (over: Partial<ReportMenage> & { id: string }): ReportMenage => ({
  date_prevue: "2026-10-02",
  date_realisation: null,
  horaire_prevu: null,
  duree_estimee_min: null,
  status: "valide",
  external_source: null,
  currency: "EUR",
  prix_prevu: null,
  client_price_ht: null,
  client_vat_rate: null,
  validated_price: null,
  provider_price: null,
  laundry_included: false,
  laundry_client_price_ht: null,
  laundry_provider_price: null,
  logement_id: "l1",
  logement_name: "Villa Rosa",
  logement_address: null,
  logement_city: "Nice",
  logement_color: null,
  referent_first_name: "Paul",
  referent_last_name: "Martin",
  prestataires: [],
  ...over,
});

const money = (s: string) => (c: string) => c.replace(/\s/g, " ") === s;
const kpi = (label: string) => screen.getByText(label, { selector: "p" }).nextElementSibling?.textContent?.replace(/\s/g, " ");

/**
 * `params` est lu avec `use()` : un thenable déjà marqué `fulfilled` est lu de
 * façon synchrone par React, sans suspendre (comme le fait Next en pratique).
 */
const params = Object.assign(Promise.resolve({ id: "c1" }), { status: "fulfilled", value: { id: "c1" } });

function renderPage() {
  return render(
    <Suspense fallback={null}>
      <ClientReportPage params={params} />
    </Suspense>,
  );
}

beforeEach(() => {
  // `<style jsx global>` (styled-jsx) n'est pas compris hors de Next : React
  // avertit sur les attributs `jsx`/`global`, sans conséquence ici.
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 10));
  authState.user = user({ id: "admin-1", role: "admin" });
  reportState.isLoading = false;
  reportState.data = {
    client,
    period: { from: "2026-10-01", to: "2026-10-31" },
    menages: [
      // Prix validé prioritaire sur le prix prévu ; linge inclus côté client ET presta.
      row({ id: "r1", validated_price: "100", client_price_ht: "90", client_vat_rate: "20", laundry_included: true,
        laundry_client_price_ht: "10", provider_price: "60", laundry_provider_price: "5" }),
      // Pas de prix validé → prix prévu ; TVA absente → 20 % ; linge non inclus → ignoré.
      row({ id: "r2", date_prevue: "2026-10-03", client_price_ht: "50", provider_price: "30",
        laundry_client_price_ht: "99", laundry_provider_price: "99", prestataires: [{ id: "a", first_name: "Ana", last_name: "Lopez" }, { id: "b", first_name: "Bob", last_name: "Roy" }] }),
    ],
  };
});

afterEach(() => vi.useRealTimers());

describe("Rapport compta d'un client", () => {
  it("CA HT = prix validé (sinon prévu) + linge si inclus ; coût = presta + linge presta ; marge = CA − coût", async () => {
    renderPage();
    expect(await screen.findAllByRole("heading", { name: "Rapport compta — Dupont SARL" })).toHaveLength(2); // écran + version imprimable
    expect(kpi("Ménages")).toBe("2");
    expect(kpi("CA HT")).toBe("160,00 €");
    expect(kpi("TVA")).toBe("32,00 €");
    expect(kpi("TTC")).toBe("192,00 €");
    expect(kpi("Coût presta")).toBe("95,00 €");
    expect(kpi("Marge")).toBe("65,00 €");
  });

  it("détaille chaque ligne : linge coché, prestataires multiples, sous-total du mois", async () => {
    renderPage();
    expect(await screen.findAllByRole("heading", { name: "Rapport compta — Dupont SARL" })).toHaveLength(2); // écran + version imprimable
    const rows = screen.getAllByRole("row");
    const r1 = rows.find((r) => within(r).queryByText("02/10/2026"))!;
    expect(within(r1).getByText("✓")).toBeInTheDocument();
    expect(within(r1).getByText("Paul Martin")).toBeInTheDocument();
    expect(within(r1).getByText(money("132,00 €"))).toBeInTheDocument();
    expect(within(r1).getByText(money("45,00 €"))).toBeInTheDocument();

    const r2 = rows.find((r) => within(r).queryByText("03/10/2026"))!;
    expect(within(r2).getByText("—")).toBeInTheDocument();
    expect(within(r2).getByText("Ana Lopez, Bob Roy")).toBeInTheDocument();
    expect(screen.getByText("octobre 2026 · 2 ménages")).toBeInTheDocument();
  });

  it("l'export CSV nomme le fichier d'après le client et la période", async () => {
    const u = userEvent.setup();
    const createObjectURL = vi.fn(() => "blob:rapport");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    let downloaded = "";
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download;
    });
    renderPage();
    await u.click(await screen.findByRole("button", { name: /CSV/ }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(downloaded).toBe("rapport-dupont-sarl-2026-10-01_2026-10-31.csv");
    vi.unstubAllGlobals();
  });

  it("sans ménage sur la période, l'export est désactivé et un message l'explique", async () => {
    reportState.data = { client, period: { from: "", to: "" }, menages: [] };
    renderPage();
    await screen.findByText("Aucun ménage sur la période.");
    expect(screen.getByRole("button", { name: /CSV/ })).toBeDisabled();
  });

  it("est réservé aux administrateurs", async () => {
    authState.user = user({ id: "paul", role: "prestataire" });
    renderPage();
    expect(await screen.findByText("Accès réservé aux administrateurs.")).toBeInTheDocument();
  });
});
