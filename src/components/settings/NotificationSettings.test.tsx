import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query";
import { apiFetch } from "@/lib/api";
import NotificationSettings from "./NotificationSettings";
import LogementNotificationLevel from "@/components/logement/LogementNotificationLevel";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const apiFetchMock = vi.mocked(apiFetch);

const PREFS = {
  push_enabled: true,
  assignment: true,
  available: true,
  reminders: true,
  reschedule: true,
  presence: true,
  pointage: true,
  validation: true,
  comments: false,
  mentions: true,
  consumables: true,
  invitations: true,
  reports: true,
  logements: [{ logement_id: "l1", logement_name: "Villa des Oliviers", level: "none" }],
};

function renderWith(ui: React.ReactElement) {
  const { Wrapper } = createQueryWrapper();
  render(<Wrapper>{ui}</Wrapper>);
}

describe("NotificationSettings", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    // L'API garde l'état : la relecture après une modification la reflète.
    let state = { ...PREFS };
    apiFetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: unknown }) => {
      if (url === "/notification-preferences" && init?.method === "PATCH") {
        state = { ...state, ...(init.body as object) };
        return init.body as never;
      }
      return (url === "/notification-preferences" ? state : {}) as never;
    });
  });

  it("affiche l’interrupteur général, les catégories et les logements réglés", async () => {
    renderWith(<NotificationSettings isAdmin />);
    expect(await screen.findByText("Villa des Oliviers")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Recevoir les notifications/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Commentaires" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Contenus signalés" })).toBeInTheDocument();
  });

  it("les signalements ne sont pas proposés à un non-admin", async () => {
    renderWith(<NotificationSettings isAdmin={false} />);
    await screen.findByText("Villa des Oliviers");
    expect(screen.queryByRole("checkbox", { name: "Contenus signalés" })).not.toBeInTheDocument();
  });

  it("couper tout envoie push_enabled et grise les catégories", async () => {
    renderWith(<NotificationSettings isAdmin />);
    const general = await screen.findByRole("checkbox", { name: /Recevoir les notifications/ });
    await userEvent.click(general);
    expect(apiFetchMock).toHaveBeenCalledWith("/notification-preferences", {
      method: "PATCH",
      body: { push_enabled: false },
    });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Mentions (@)" })).toBeDisabled());
  });

  it("« Tout recevoir » remet un logement sur tout", async () => {
    renderWith(<NotificationSettings isAdmin />);
    await userEvent.click(await screen.findByRole("button", { name: "Tout recevoir" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/notification-preferences/logements/l1", {
      method: "PUT",
      body: { level: "all" },
    });
  });
});

describe("LogementNotificationLevel", () => {
  it("montre le réglage courant et en change", async () => {
    apiFetchMock.mockReset();
    apiFetchMock.mockImplementation(async () => ({ logement_id: "l1", level: "important" }) as never);
    renderWith(<LogementNotificationLevel logementId="l1" />);
    await waitFor(() =>
      expect(screen.getByRole("radio", { name: "L’important" })).toHaveAttribute("aria-checked", "true"),
    );
    await waitFor(() => expect(screen.getByRole("radio", { name: "Rien" })).toBeEnabled());
    await userEvent.click(screen.getByRole("radio", { name: "Rien" }));
    expect(apiFetchMock).toHaveBeenCalledWith("/notification-preferences/logements/l1", {
      method: "PUT",
      body: { level: "none" },
    });
  });
});
