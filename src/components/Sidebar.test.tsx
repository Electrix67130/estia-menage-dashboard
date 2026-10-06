import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/contexts/I18nContext";
import type { User } from "@/types/api";
import { pathnameMock } from "@/test/setup";
import Sidebar from "./Sidebar";

const authState: { user: User | null } = { user: null };
const unread: { by_type: Record<string, number> } = { by_type: {} };
const pending: { count: number } = { count: 0 };

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: authState.user }),
}));
vi.mock("@/hooks/useMenageViews", () => ({
  useUnreadSummary: () => ({ data: { by_menage: {}, by_organization: {}, by_type: unread.by_type } }),
}));
vi.mock("@/hooks/useRescheduleRequests", () => ({
  useRescheduleRequests: () => ({
    data: { data: Array.from({ length: pending.count }, (_, i) => ({ id: `r${i}`, status: "pending" })) },
  }),
}));

const user = (role: User["role"], over: Partial<User> = {}): User => ({
  id: "u",
  email: "u@e.fr",
  first_name: "A",
  last_name: "B",
  role,
  is_active: true,
  push_enabled: true,
  created_at: "",
  updated_at: "",
  ...over,
});

function renderSidebar() {
  return render(
    <I18nProvider>
      <Sidebar open onClose={() => {}} />
    </I18nProvider>,
  );
}

const navLinks = () => within(screen.getAllByRole("navigation")[0]).getAllByRole("link");
const linkNamed = (name: string) => navLinks().find((a) => a.textContent?.includes(name));

beforeEach(() => {
  authState.user = user("admin");
  unread.by_type = {};
  pending.count = 0;
});

describe("Barre latérale — entrées selon le rôle", () => {
  it("l'admin voit Planning, Demandes de changement, Gains, Factures et Abonnement", () => {
    renderSidebar();
    for (const label of ["Planning", "Demandes de changement", "Gains", "Factures", "Abonnement"]) {
      expect(linkNamed(label), label).toBeDefined();
    }
  });

  it("le prestataire ne voit ni Planning, ni Demandes, ni Gains, ni Factures, ni Abonnement", () => {
    authState.user = user("prestataire");
    renderSidebar();
    for (const label of ["Planning", "Demandes de changement", "Gains", "Factures", "Abonnement"]) {
      expect(linkNamed(label), label).toBeUndefined();
    }
    expect(linkNamed("Ménages")).toBeDefined();
    expect(linkNamed("Historique")).toBeDefined();
  });

  it("la section super admin n'apparaît qu'avec le flag is_super_admin", () => {
    renderSidebar();
    expect(screen.queryByText("Super admin")).toBeNull();
  });

  it("le super admin a une seconde navigation", () => {
    authState.user = user("admin", { is_super_admin: true });
    renderSidebar();
    expect(screen.getByText("Super admin")).toBeInTheDocument();
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
  });
});

describe("Barre latérale — badges non lus ventilés par type", () => {
  it("le badge « Ménages » ne compte que les ménages, check-in / check-out ont le leur", () => {
    unread.by_type = { menage: 3, check_in: 2 };
    renderSidebar();
    expect(within(linkNamed("Ménages")!).getByText("3")).toBeInTheDocument();
    expect(within(linkNamed("Check-in")!).getByText("2")).toBeInTheDocument();
    expect(within(linkNamed("Check-out")!).queryByText(/\d/)).toBeNull();
  });

  it("plafonne l'affichage à 99+", () => {
    unread.by_type = { menage: 250 };
    renderSidebar();
    expect(within(linkNamed("Ménages")!).getByText("99+")).toBeInTheDocument();
  });

  it("les demandes de report en attente badgent l'entrée dédiée (admin)", () => {
    pending.count = 4;
    renderSidebar();
    expect(within(linkNamed("Demandes de changement")!).getByText("4")).toBeInTheDocument();
  });
});

describe("Barre latérale — entrée active", () => {
  it("surligne l'entrée dont le chemin correspond (y compris les sous-pages)", () => {
    pathnameMock.current = "/menages/abc";
    renderSidebar();
    expect(linkNamed("Ménages")).toHaveClass("text-blue-700");
    expect(linkNamed("Logements")).not.toHaveClass("text-blue-700");
  });
});
