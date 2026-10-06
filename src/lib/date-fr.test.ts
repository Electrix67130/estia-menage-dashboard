import { describe, expect, it } from "vitest";
import { formatCurrencyFr, formatDateFr, formatRelativeFr } from "./date-fr";

/** Les formateurs Intl insèrent des espaces insécables : on les normalise. */
const plain = (s: string) => s.replace(/\s/g, " ");

describe("Dates en français (formatDateFr)", () => {
  // Vendredi 15 mai 2026, 14:30 heure de Paris.
  const d = "2026-05-15T14:30:00+02:00";

  it("décline une même date selon la variante demandée", () => {
    expect(formatDateFr(d, "short")).toBe("15/05/2026");
    expect(formatDateFr(d, "long")).toBe("15 mai 2026");
    expect(formatDateFr(d, "weekday")).toBe("vendredi 15 mai 2026");
    expect(formatDateFr(d, "month")).toBe("mai 2026");
    expect(formatDateFr(d, "datetime")).toBe("15/05/2026 14:30");
    expect(formatDateFr(d, "time")).toBe("14:30");
  });

  it("utilise le format court par défaut et accepte un objet Date", () => {
    expect(formatDateFr(new Date(2026, 4, 15))).toBe("15/05/2026");
  });

  it("accepte une date seule (YYYY-MM-DD) telle que renvoyée par l'API", () => {
    expect(formatDateFr("2026-10-05", "weekday")).toBe("lundi 5 octobre 2026");
  });

  it("renvoie une chaîne vide pour une valeur absente ou invalide", () => {
    expect(formatDateFr(null)).toBe("");
    expect(formatDateFr(undefined)).toBe("");
    expect(formatDateFr("")).toBe("");
    expect(formatDateFr("pas-une-date")).toBe("");
  });
});

describe("Montants en euros (formatCurrencyFr)", () => {
  it("formate un nombre ou une chaîne numérique avec deux décimales", () => {
    expect(plain(formatCurrencyFr(1234.5))).toBe("1 234,50 €");
    expect(plain(formatCurrencyFr("12"))).toBe("12,00 €");
    expect(plain(formatCurrencyFr(0))).toBe("0,00 €");
  });

  it("respecte la devise demandée", () => {
    expect(plain(formatCurrencyFr(10, "CHF"))).toContain("CHF");
  });

  it("affiche un tiret quand le montant est absent ou illisible", () => {
    expect(formatCurrencyFr(null)).toBe("—");
    expect(formatCurrencyFr(undefined)).toBe("—");
    expect(formatCurrencyFr("")).toBe("—");
    expect(formatCurrencyFr("abc")).toBe("—");
  });
});

describe("Date relative courte (formatRelativeFr)", () => {
  const now = new Date("2026-10-05T12:00:00+02:00");
  const ago = (ms: number) => new Date(now.getTime() - ms);
  const MIN = 60_000;
  const H = 60 * MIN;
  const DAY = 24 * H;

  it("« à l'instant » sous la minute, puis minutes, heures, jours", () => {
    expect(formatRelativeFr(ago(30_000), now)).toBe("à l'instant");
    expect(formatRelativeFr(ago(5 * MIN), now)).toBe("il y a 5 min");
    expect(formatRelativeFr(ago(2 * H), now)).toBe("il y a 2 h");
    expect(formatRelativeFr(ago(3 * DAY), now)).toBe("il y a 3 j");
    expect(formatRelativeFr(ago(7 * DAY), now)).toBe("il y a 7 j");
  });

  it("au-delà de 7 jours, bascule sur la date courte", () => {
    expect(formatRelativeFr(ago(8 * DAY), now)).toBe("le 27/09/2026");
  });

  it("ne produit jamais de « dans … » : une date future est traitée comme immédiate", () => {
    expect(formatRelativeFr(new Date(now.getTime() + H), now)).toBe("à l'instant");
  });

  it("accepte une chaîne ISO et ignore les valeurs vides", () => {
    expect(formatRelativeFr(ago(10 * MIN).toISOString(), now)).toBe("il y a 10 min");
    expect(formatRelativeFr(null, now)).toBe("");
    expect(formatRelativeFr("n'importe quoi", now)).toBe("");
  });
});
