import { describe, expect, it } from "vitest";
import type { LogementMember, Menage, User } from "@/types/api";
import {
  BILLABLE_ROLES,
  canCreateMenage,
  canDeleteMenage,
  canEditMenage,
  canInviteOrgMember,
  canManageLogementMembers,
  canManageSteps,
  canSeeBillingSection,
  canSeeOrgTeamSection,
  canToggleSteps,
  canViewComments,
  canViewEmergencies,
  canViewPhotos,
  isBillableRole,
  isSuperAdmin,
  orgToMenageRole,
  type MenageContext,
} from "./permissions";

const user = (over: Partial<User> = {}): User => ({
  id: "u1",
  email: "u@example.com",
  first_name: "Ana",
  last_name: "Lopez",
  role: "prestataire",
  is_active: true,
  push_enabled: true,
  created_at: "",
  updated_at: "",
  ...over,
});

const admin = user({ id: "admin", role: "admin" });
const presta = user({ id: "presta", role: "prestataire" });

const menage = (created_by: string): Menage => ({
  id: "m1",
  name: "Villa",
  status: "a_venir",
  created_by,
  organization_id: "org",
  created_at: "",
  updated_at: "",
});

const member = (over: Partial<LogementMember> = {}): LogementMember => ({
  id: "lm1",
  menage_id: "m1",
  user_id: "presta",
  role: "prestataire",
  created_at: "",
  ...over,
});

const ctx = (over: Partial<MenageContext>): MenageContext => ({
  user: presta,
  menage: menage("someone-else"),
  currentMember: null,
  ...over,
});

describe("Permissions — navigation", () => {
  it("la facturation est réservée à l'admin, l'équipe et les modèles à tout connecté", () => {
    expect(canSeeBillingSection(admin)).toBe(true);
    expect(canSeeBillingSection(presta)).toBe(false);
    expect(canSeeBillingSection(null)).toBe(false);
    expect(canSeeOrgTeamSection(presta)).toBe(true);
    expect(canSeeOrgTeamSection(null)).toBe(false);
  });

  it("la console super admin dépend du flag is_super_admin, pas du rôle", () => {
    expect(isSuperAdmin(admin)).toBe(false);
    expect(isSuperAdmin(user({ is_super_admin: true }))).toBe(true);
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe("Permissions — liste des prestations", () => {
  it("créer / supprimer une prestation : admin uniquement", () => {
    expect(canCreateMenage(admin)).toBe(true);
    expect(canCreateMenage(presta)).toBe(false);
    expect(canDeleteMenage(admin)).toBe(true);
    expect(canDeleteMenage(presta)).toBe(false);
    expect(canDeleteMenage(null)).toBe(false);
  });
});

describe("Permissions — détail d'une prestation", () => {
  it("l'admin et le créateur voient tout", () => {
    expect(canViewComments(ctx({ user: admin }))).toBe(true);
    expect(canViewPhotos(ctx({ user: presta, menage: menage("presta") }))).toBe(true);
  });

  it("un membre ne voit un onglet que si sa permission est accordée", () => {
    expect(canViewComments(ctx({ currentMember: member({ can_view_comments: true }) }))).toBe(true);
    expect(canViewComments(ctx({ currentMember: member({ can_view_comments: false }) }))).toBe(false);
    expect(canViewPhotos(ctx({ currentMember: member() }))).toBe(false);
  });

  it("être membre suffit pour cocher la checklist et voir les urgences", () => {
    expect(canToggleSteps(ctx({ currentMember: member() }))).toBe(true);
    expect(canViewEmergencies(ctx({ currentMember: member() }))).toBe(true);
    expect(canToggleSteps(ctx({}))).toBe(false);
  });

  it("gérer les étapes : manager du logement ou membre avec can_edit", () => {
    expect(canManageSteps(ctx({ currentMember: member({ role: "manager" }) }))).toBe(true);
    expect(canManageSteps(ctx({ currentMember: member({ can_edit: true }) }))).toBe(true);
    expect(canManageSteps(ctx({ currentMember: member() }))).toBe(false);
    expect(canEditMenage(ctx({ currentMember: member({ can_edit: true }) }))).toBe(true);
  });

  it("gérer les membres du logement : admin ou créateur seulement", () => {
    expect(canManageLogementMembers(ctx({ user: admin }))).toBe(true);
    expect(canManageLogementMembers(ctx({ currentMember: member({ role: "manager" }) }))).toBe(false);
  });
});

describe("Permissions — organisation", () => {
  it("inviter : admin uniquement", () => {
    expect(canInviteOrgMember(admin)).toBe(true);
    expect(canInviteOrgMember(presta)).toBe(false);
  });

  it("rôle org → rôle logement par défaut", () => {
    expect(orgToMenageRole("admin")).toBe("manager");
    expect(orgToMenageRole("prestataire")).toBe("prestataire");
  });

  it("tous les rôles sont des sièges facturables", () => {
    expect(isBillableRole("admin")).toBe(true);
    expect(isBillableRole("prestataire")).toBe(true);
    expect(BILLABLE_ROLES.size).toBe(2);
  });
});
