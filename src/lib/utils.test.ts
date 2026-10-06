import { describe, expect, it } from "vitest";
import { cn, formatDate, formatDateTime, initials } from "./utils";

describe("cn (classes Tailwind)", () => {
  it("fusionne les classes en gardant la dernière valeur d'une même propriété", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", false && "hidden", undefined, "font-bold")).toBe("text-sm font-bold");
  });
});

describe("initials", () => {
  it("prend la première lettre du prénom et du nom, en majuscules", () => {
    expect(initials("jean", "dupont")).toBe("JD");
    expect(initials("Jean")).toBe("J");
  });

  it("affiche « ? » sans prénom ni nom", () => {
    expect(initials()).toBe("?");
    expect(initials("", "")).toBe("?");
  });
});

describe("formatDate / formatDateTime", () => {
  it("formatent en long et en date-heure, avec un tiret si vide", () => {
    expect(formatDate("2026-05-15")).toBe("15 mai 2026");
    expect(formatDateTime("2026-05-15T14:30:00+02:00")).toBe("15/05/2026 14:30");
    expect(formatDate(null)).toBe("—");
    expect(formatDateTime(undefined)).toBe("—");
  });
});
