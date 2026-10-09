import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query";
import { apiFetch } from "@/lib/api";
import { DialogProvider } from "@/contexts/DialogContext";
import type { Report } from "@/hooks/useReports";
import ReportList, { contentDeletePath } from "./ReportList";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const apiFetchMock = vi.mocked(apiFetch);

const report = (over: Partial<Report> = {}): Report => ({
  id: "r1",
  organization_id: "o1",
  menage_id: "m1",
  reporter_id: "u1",
  target_type: "comment",
  target_id: "c1",
  target_user_id: "u2",
  target_excerpt: "Propos déplacés",
  reason: "harassment",
  comment: "Encore une fois",
  status: "pending",
  escalated: false,
  resolved_by: null,
  resolved_at: null,
  resolution_note: null,
  created_at: "2026-10-09T08:00:00.000Z",
  reporter_first_name: "Léa",
  reporter_last_name: "Dubois",
  target_first_name: "Sofia",
  target_last_name: "Martin",
  logement_name: "Villa des Oliviers",
  menage_date: "2026-10-10",
  organization_name: "Estia",
  target_exists: true,
  ...over,
});

function renderList(reports: Report[], isConsole = false) {
  const { Wrapper } = createQueryWrapper();
  render(
    <Wrapper>
      <DialogProvider>
        <ReportList reports={reports} console={isConsole} />
      </DialogProvider>
    </Wrapper>,
  );
}

beforeEach(() => {
  apiFetchMock.mockResolvedValue({});
});

describe("contentDeletePath", () => {
  it("un message ou une photo se suppriment, un membre non", () => {
    expect(contentDeletePath({ target_type: "comment", target_id: "c1" })).toBe("/comments/c1");
    expect(contentDeletePath({ target_type: "photo", target_id: "p1" })).toBe("/photos/p1");
    expect(contentDeletePath({ target_type: "user", target_id: "u1" })).toBeNull();
  });
});

describe("ReportList", () => {
  it("affiche motif, rapporteur, personne visée, prestation et extrait", () => {
    renderList([report()]);
    expect(screen.getByText("Harcèlement")).toBeInTheDocument();
    expect(screen.getByText(/Signalé par Léa Dubois/)).toBeInTheDocument();
    expect(screen.getByText(/concerne Sofia Martin/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Villa des Oliviers/ })).toHaveAttribute("href", "/menages/m1");
    expect(screen.getByText("Propos déplacés")).toBeInTheDocument();
  });

  it("rejeter un signalement envoie PATCH /reports/:id", async () => {
    const user = userEvent.setup();
    renderList([report()]);
    await user.click(screen.getByRole("button", { name: "Rejeter" }));
    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/reports/r1", {
        method: "PATCH",
        body: { status: "dismissed", resolution_note: undefined },
      }),
    );
  });

  it("supprimer le contenu passe par une confirmation", async () => {
    const user = userEvent.setup();
    renderList([report()]);
    await user.click(screen.getByRole("button", { name: "Supprimer le contenu" }));
    expect(apiFetchMock).not.toHaveBeenCalled();
    const confirmer = await screen.findAllByRole("button", { name: "Supprimer" });
    await user.click(confirmer.at(-1)!);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/comments/c1", { method: "DELETE" }));
  });

  it("contenu déjà supprimé : on le dit, et on ne propose plus de le supprimer", () => {
    renderList([report({ target_exists: false })]);
    expect(screen.getByText("Le contenu a déjà été supprimé.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer le contenu" })).toBeNull();
  });

  it("console : le nom de l'organisation, et pas de suppression de contenu", () => {
    renderList([report({ escalated: true })], true);
    expect(screen.getByText(/· Estia/)).toBeInTheDocument();
    expect(screen.getByText("Vise un admin")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Supprimer le contenu" })).toBeNull();
  });

  it("vide : un état vide", () => {
    renderList([]);
    expect(screen.getByText("Aucun signalement")).toBeInTheDocument();
  });
});
