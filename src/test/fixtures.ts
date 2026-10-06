import type { CalendarMenage } from "@/hooks/useCalendarMenages";
import type { RescheduleRequest, User } from "@/types/api";

/** Prestation telle que renvoyée par `GET /menages` (valeurs neutres, à surcharger). */
export function menage(over: Partial<CalendarMenage> & { id: string; date_prevue: string }): CalendarMenage {
  return {
    logement_id: "l1",
    created_by: "admin-1",
    external_source: null,
    prestataire_user_id: null,
    prestataire_first_name: null,
    prestataire_last_name: null,
    prestataire_avatar_url: null,
    logement_name: "Villa Rosa",
    logement_address: "1 rue des Fleurs",
    logement_city: "Nice",
    logement_color: null,
    status: "a_venir",
    prestation_type: "menage",
    external_event_uid: null,
    horaire_prevu: null,
    duree_estimee_min: null,
    present_count: 0,
    absent_count: 0,
    member_prestataire_count: 0,
    ...over,
  };
}

export function user(over: Partial<User> & { id: string }): User {
  return {
    email: `${over.id}@example.com`,
    first_name: "Prénom",
    last_name: "Nom",
    role: "prestataire",
    is_active: true,
    push_enabled: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

export function reschedule(over: Partial<RescheduleRequest> & { id: string; menage_id: string }): RescheduleRequest {
  return {
    requested_by: "paul",
    original_date: "2026-10-05",
    proposed_date: "2026-10-07",
    proposed_time: "14:30:00",
    reason: null,
    status: "pending",
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    created_at: "2026-10-04T10:00:00Z",
    updated_at: "2026-10-04T10:00:00Z",
    ...over,
  };
}

export const paginated = <T,>(data: T[]) => ({
  data,
  meta: { total: data.length, page: 1, limit: data.length, totalPages: 1 },
});
