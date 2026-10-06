import { describe, expect, it } from "vitest";
import { roleBadgeClass, roleDotClass } from "./role-style";

describe("Couleur des rôles", () => {
  it("admin en violet, prestataire en bleu, pour le badge comme pour la pastille", () => {
    expect(roleBadgeClass("admin")).toMatch(/violet/);
    expect(roleBadgeClass("prestataire")).toMatch(/blue/);
    expect(roleDotClass("admin")).toBe("h-1.5 w-1.5 rounded-full bg-violet-500");
    expect(roleDotClass("prestataire")).toBe("h-1.5 w-1.5 rounded-full bg-blue-500");
  });
});
