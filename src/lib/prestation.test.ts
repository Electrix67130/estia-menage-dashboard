import { describe, expect, it } from "vitest";
import {
  PAST_WINDOW_DAYS,
  addDays,
  prestationTypeLabel,
  prestationTypePill,
  ymdLocal,
} from "./prestation";

describe("Type de prestation (ménage / check-in / check-out)", () => {
  it("libellés UI, avec « Ménage » par défaut quand le type est absent", () => {
    expect(prestationTypeLabel("menage")).toBe("Ménage");
    expect(prestationTypeLabel("check_in")).toBe("Check-in");
    expect(prestationTypeLabel("check_out")).toBe("Check-out");
    expect(prestationTypeLabel(null)).toBe("Ménage");
    expect(prestationTypeLabel(undefined)).toBe("Ménage");
  });

  it("tag coloré : Ménage = bleu, Check-in = vert, Check-out = rouge", () => {
    expect(prestationTypePill("menage")).toMatch(/bg-blue-/);
    expect(prestationTypePill("check_in")).toMatch(/bg-emerald-/);
    expect(prestationTypePill("check_out")).toMatch(/bg-rose-/);
    expect(prestationTypePill(null)).toMatch(/bg-blue-/);
  });
});

describe("Fenêtre des prestations passées", () => {
  it("est de 30 jours (même valeur que le mobile)", () => {
    expect(PAST_WINDOW_DAYS).toBe(30);
  });
});

describe("Dates locales (ymdLocal / addDays)", () => {
  it("formate en YYYY-MM-DD sans basculer en UTC le soir", () => {
    // 23h30 heure de Paris le 5 octobre = déjà le 5 octobre 21:30 UTC, mais
    // toISOString() aurait donné le bon jour ici ; le cas qui casse est après
    // minuit UTC : 00h30 Paris = 22h30 UTC la veille.
    expect(ymdLocal(new Date(2026, 9, 5, 23, 30))).toBe("2026-10-05");
    expect(ymdLocal(new Date(2026, 9, 6, 0, 30))).toBe("2026-10-06");
    expect(ymdLocal(new Date(2026, 0, 1))).toBe("2026-01-01");
  });

  it("ajoute ou retire des jours en gérant les changements de mois et d'année", () => {
    expect(ymdLocal(addDays(new Date(2026, 9, 31), 1))).toBe("2026-11-01");
    expect(ymdLocal(addDays(new Date(2026, 0, 1), -1))).toBe("2025-12-31");
    expect(ymdLocal(addDays(new Date(2026, 9, 5), -PAST_WINDOW_DAYS))).toBe("2026-09-05");
  });

  it("ne mute pas la date d'origine", () => {
    const d = new Date(2026, 9, 5);
    addDays(d, 10);
    expect(ymdLocal(d)).toBe("2026-10-05");
  });
});
