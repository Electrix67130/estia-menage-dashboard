/**
 * Permissions Estia — référence : `docs/PERMISSIONS.md`.
 *
 * L'API enforce les vraies règles côté serveur. Ces helpers servent
 * uniquement à masquer/désactiver des éléments UI côté client.
 *
 * Rôles org : admin | prestataire.
 * Rôles logement : manager | prestataire | client_proprietaire.
 */

import type {
  LogementMember,
  LogementMemberRole,
  Menage,
  User,
  UserRole,
} from "@/types/api";

// ---------- Navigation ----------

export const canSeeOrgTeamSection = (user: User | null): boolean => !!user;
export const canSeeTemplatesSection = (user: User | null): boolean => !!user;
export const canSeeBillingSection = (user: User | null): boolean =>
  user?.role === "admin";

export const isSuperAdmin = (user: User | null): boolean => !!user?.is_super_admin;

// ---------- Menages (liste) ----------

export const canCreateMenage = (user: User | null): boolean => user?.role === "admin";
export const canDeleteMenage = (user: User | null): boolean => user?.role === "admin";
export const canArchiveMenage = (user: User | null): boolean => user?.role === "admin";
export const canChangeMenageRetention = (user: User | null): boolean =>
  user?.role === "admin";

// ---------- Menage — contexte d'un user ----------

export interface MenageContext {
  user: User | null;
  menage: Menage | null;
  currentMember: LogementMember | null;
}

export const isAdmin = (ctx: MenageContext): boolean => ctx.user?.role === "admin";
export const isCreator = (ctx: MenageContext): boolean =>
  !!ctx.menage && !!ctx.user && ctx.menage.created_by === ctx.user.id;
export const isMenageManager = (ctx: MenageContext): boolean =>
  ctx.currentMember?.role === "manager";

// ---------- Visibilité des onglets ----------

export const canViewComments = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember?.can_view_comments;

export const canViewPhotos = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember?.can_view_photos;

export const canViewDocuments = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember?.can_view_documents;

export const canViewSteps = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember?.can_view_steps;

export const canViewTeam = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember?.can_view_team;

export const canViewEmergencies = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember;

// ---------- Actions sur le menage ----------

export const canEditMenage = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember?.can_edit;

export const canManageSteps = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || isMenageManager(ctx) || !!ctx.currentMember?.can_edit;

export const canToggleSteps = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember;

export const canCreateEmergency = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx) || !!ctx.currentMember;

export const canSendMessage = (ctx: MenageContext): boolean => canViewComments(ctx);

export const canDeleteOthersMessage = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx);

// ---------- Équipe du menage ----------

export const canManageLogementMembers = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx);

export const canEditMenagePermissions = (ctx: MenageContext): boolean =>
  isAdmin(ctx) || isCreator(ctx);

// Mapping rôle org → rôle logement (auto à l'ajout).
export const orgToMenageRole = (orgRole: UserRole): LogementMemberRole => {
  switch (orgRole) {
    case "admin":
      return "manager";
    case "prestataire":
      return "prestataire";
  }
};

// ---------- Équipe (organisation) ----------

export const canInviteOrgMember = (user: User | null): boolean =>
  user?.role === "admin";
export const canChangeOrgMemberRole = (user: User | null): boolean =>
  user?.role === "admin";
export const canRemoveOrgMember = (user: User | null): boolean =>
  user?.role === "admin";

// ---------- Sièges facturables ----------

export const BILLABLE_ROLES = new Set<UserRole>(["admin", "prestataire"]);
export const isBillableRole = (role: UserRole): boolean => BILLABLE_ROLES.has(role);
