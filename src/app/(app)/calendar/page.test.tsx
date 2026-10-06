import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { renderWithQuery } from "@/test/query";
import { menage, paginated, user } from "@/test/fixtures";
import type { User } from "@/types/api";
import CalendarPage from "./page";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
const authState: { user: User | null } = { user: null };
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: authState.user }) }));

const paul = { prestataire_user_id: "paul", prestataire_first_name: "Paul", prestataire_last_name: "Martin" };

// Séjour 1 (uid-1) : arrivée sam. 10/10 16h → départ mar. 13/10 10h, ménage le 13.
// Séjour 2 (uid-2) : arrivée mar. 13/10 15h (turnover le même jour) → ménage le 16.
// Un ménage manuel seul le 20/10, sans prestataire.
const octobre = () => [
  menage({ id: "ci1", date_prevue: "2026-10-10", prestation_type: "check_in", external_event_uid: "uid-1", horaire_prevu: "16:00:00", external_source: "cal_airbnb", logement_color: "#ff0000", ...paul }),
  menage({ id: "mn1", date_prevue: "2026-10-13", prestation_type: "menage", external_event_uid: "uid-1", stay_nights: 3, external_source: "cal_airbnb", logement_color: "#ff0000", ...paul }),
  menage({ id: "co1", date_prevue: "2026-10-13", prestation_type: "check_out", external_event_uid: "uid-1", horaire_prevu: "10:00:00", external_source: "cal_airbnb", logement_color: "#ff0000", ...paul }),
  menage({ id: "ci2", date_prevue: "2026-10-13", prestation_type: "check_in", external_event_uid: "uid-2", horaire_prevu: "15:00:00", external_source: "cal_airbnb", logement_color: "#ff0000", ...paul }),
  menage({ id: "mn2", date_prevue: "2026-10-16", prestation_type: "menage", external_event_uid: "uid-2", stay_nights: 3, external_source: "cal_airbnb", logement_color: "#ff0000", ...paul }),
  menage({ id: "m-x", date_prevue: "2026-10-20", logement_id: "l2", logement_name: "Loft Bleu", horaire_prevu: "09:00:00" }),
];

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 5, 10));
  authState.user = user({ id: "admin-1", role: "admin" });
  apiFetchMock.mockImplementation(async (path: string): Promise<unknown> => {
    if (path.startsWith("/menages?")) return paginated(octobre());
    if (path.startsWith("/users")) return paginated([user({ id: "paul", first_name: "Paul", last_name: "Martin" })]);
    if (path.startsWith("/logements")) return paginated([{ id: "l1", name: "Villa Rosa", archived_at: null }, { id: "l2", name: "Loft Bleu", archived_at: null }]);
    throw new Error(`Route non mockée : ${path}`);
  });
});

afterEach(() => vi.useRealTimers());

const barsTo = (id: string) => Array.from(document.querySelectorAll<HTMLAnchorElement>(`a[href="/menages/${id}"][style]`));
/** Les `Select` de filtre n'ont pas d'id : on passe par le libellé affiché juste au-dessus. */
const selectUnder = (label: string) =>
  screen.getByText(label, { selector: "label" }).parentElement!.querySelector("select")!;
const monthList = () => screen.getByRole("heading", { name: "Liste du mois" }).parentElement!;

async function renderCalendar() {
  const utils = renderWithQuery(<CalendarPage />);
  await screen.findByText("6 ménages ce mois");
  return utils;
}

describe("Calendrier — vue classique", () => {
  it("charge le mois courant et liste les prestations ; « Non assigné » quand il n'y a personne", async () => {
    await renderCalendar();
    expect(apiFetchMock.mock.calls[0][0]).toBe("/menages?from=2026-10-01&to=2026-10-31&limit=200");
    expect(screen.getByRole("heading", { level: 1, name: "octobre 2026" })).toBeInTheDocument();
    const list = monthList();
    expect(within(list).getAllByRole("listitem")).toHaveLength(6);
    expect(within(list).getByText("Non assigné")).toBeInTheDocument();
    expect(within(list).getAllByText("Paul Martin")).toHaveLength(5);
  });

  it("le filtre prestataire « Non assigné » ne garde que les prestations sans prestataire", async () => {
    const u = userEvent.setup();
    await renderCalendar();
    await u.selectOptions(selectUnder("Prestataire"), "__unassigned__");
    expect(screen.getByText("1 / 6 ménages ce mois")).toBeInTheDocument();
    expect(within(monthList()).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Réinitialiser" })).toBeInTheDocument();
  });

  it("le filtre type ne garde que les check-in", async () => {
    const u = userEvent.setup();
    await renderCalendar();
    await u.selectOptions(selectUnder("Type"), "check_in");
    expect(within(monthList()).getAllByRole("listitem")).toHaveLength(2);
  });

  it("les flèches changent de mois et « Aujourd'hui » revient", async () => {
    const u = userEvent.setup();
    await renderCalendar();
    const buttons = screen.getAllByRole("button");
    const next = buttons[buttons.indexOf(screen.getByRole("button", { name: "Aujourd'hui" })) + 1];
    await u.click(next);
    await waitFor(() => expect(apiFetchMock.mock.calls.map(([p]) => p)).toContain("/menages?from=2026-11-01&to=2026-11-30&limit=200"));
    expect(screen.getByRole("heading", { level: 1, name: "novembre 2026" })).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Aujourd'hui" }));
    expect(screen.getByRole("heading", { level: 1, name: "octobre 2026" })).toBeInTheDocument();
  });
});

describe("Calendrier — vue séjours (barres multi-jours)", () => {
  it("un séjour relie check-in, ménage et check-out ; le clic cible la bonne prestation selon le jour", async () => {
    const u = userEvent.setup();
    await renderCalendar();
    await u.click(screen.getByRole("checkbox", { name: "Vue séjours" }));

    // Jour d'arrivée → check-in ; jours intermédiaires (dim. 11, lun. 12, à cheval
    // sur deux semaines) → ménage ; jour de départ → check-out.
    expect(barsTo("ci1")).toHaveLength(1);
    expect(barsTo("mn1")).toHaveLength(2);
    expect(barsTo("co1")).toHaveLength(1);
    expect(barsTo("ci1")[0]).toHaveAttribute("title", "Paul Martin · 2026-10-10 16:00 → 2026-10-13 10:00");
    expect(barsTo("ci1")[0]).toHaveTextContent("16:00");
    expect(barsTo("co1")[0]).toHaveTextContent("10:00");
    expect(barsTo("mn1")[0].style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("turnover : le check-out (matin) et le check-in (après-midi) du même jour tiennent côte à côte", async () => {
    const u = userEvent.setup();
    await renderCalendar();
    await u.click(screen.getByRole("checkbox", { name: "Vue séjours" }));

    const depart = barsTo("co1")[0];
    const arrivee = barsTo("ci2")[0];
    expect(parseFloat(depart.style.left)).toBeCloseTo(0, 5);
    expect(parseFloat(depart.style.width)).toBeCloseTo(47, 5);
    expect(parseFloat(arrivee.style.left)).toBeCloseTo(53, 5);
    expect(parseFloat(arrivee.style.width)).toBeCloseTo(47, 5);
    // Même couloir : les deux barres partagent le même conteneur de ligne.
    expect(depart.parentElement).toBe(arrivee.parentElement);
  });

  it("un ménage manuel seul sur sa journée prend toute la case", async () => {
    const u = userEvent.setup();
    await renderCalendar();
    await u.click(screen.getByRole("checkbox", { name: "Vue séjours" }));
    const bar = barsTo("m-x");
    expect(bar).toHaveLength(1);
    expect(parseFloat(bar[0].style.left)).toBeCloseTo(3, 5);
    expect(parseFloat(bar[0].style.width)).toBeCloseTo(94, 5);
    expect(bar[0]).toHaveTextContent("Non assigné");
  });

  it("la préférence « Vue séjours » est mémorisée", async () => {
    const u = userEvent.setup();
    await renderCalendar();
    await u.click(screen.getByRole("checkbox", { name: "Vue séjours" }));
    await waitFor(() => expect(window.localStorage.getItem("calendar.spanView")).toBe("true"));
  });
});
