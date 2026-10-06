import { describe, expect, it } from "vitest";
import { formatQtyUnit, pluralizeUnitFr, singularizeUnitFr, unitForQty } from "./unit-fr";

describe("Unités de consommables accordées à la quantité", () => {
  describe("singularizeUnitFr", () => {
    it("ramène les pluriels courants au singulier", () => {
      expect(singularizeUnitFr("rouleaux")).toBe("rouleau");
      expect(singularizeUnitFr("bocaux")).toBe("bocal");
      expect(singularizeUnitFr("sachets")).toBe("sachet");
      expect(singularizeUnitFr("capsules")).toBe("capsule");
      expect(singularizeUnitFr("tuyaux")).toBe("tuyau");
      expect(singularizeUnitFr("jeux")).toBe("jeu");
    });

    it("laisse un singulier inchangé", () => {
      expect(singularizeUnitFr("flacon")).toBe("flacon");
      expect(singularizeUnitFr("boîte")).toBe("boîte");
    });

    it("ne touche pas aux abréviations ni aux libellés composés", () => {
      expect(singularizeUnitFr("L")).toBe("L");
      expect(singularizeUnitFr("kg")).toBe("kg");
      expect(singularizeUnitFr("ML")).toBe("ML");
      expect(singularizeUnitFr("sacs poubelle")).toBe("sacs poubelle");
    });

    it("tolère les espaces autour et la chaîne vide", () => {
      expect(singularizeUnitFr("  rouleaux ")).toBe("rouleau");
      expect(singularizeUnitFr("")).toBe("");
    });
  });

  describe("pluralizeUnitFr", () => {
    it("forme le pluriel depuis un singulier ou un pluriel", () => {
      expect(pluralizeUnitFr("rouleau")).toBe("rouleaux");
      expect(pluralizeUnitFr("rouleaux")).toBe("rouleaux");
      expect(pluralizeUnitFr("bocal")).toBe("bocaux");
      expect(pluralizeUnitFr("sachet")).toBe("sachets");
      expect(pluralizeUnitFr("feu")).toBe("feux");
    });

    it("laisse invariables les mots déjà en -s/-x/-z, les abréviations et les composés", () => {
      expect(pluralizeUnitFr("gaz")).toBe("gaz");
      expect(pluralizeUnitFr("L")).toBe("L");
      expect(pluralizeUnitFr("sacs poubelle")).toBe("sacs poubelle");
    });
  });

  describe("unitForQty", () => {
    it("singulier pour 0 et 1, pluriel au-delà, quelle que soit la forme saisie", () => {
      expect(unitForQty(0, "rouleaux")).toBe("rouleau");
      expect(unitForQty(1, "rouleaux")).toBe("rouleau");
      expect(unitForQty(1, "rouleau")).toBe("rouleau");
      expect(unitForQty(3, "rouleau")).toBe("rouleaux");
      expect(unitForQty(3, "rouleaux")).toBe("rouleaux");
    });

    it("raisonne sur la valeur absolue (stock négatif par erreur de saisie)", () => {
      expect(unitForQty(-2, "rouleau")).toBe("rouleaux");
    });
  });

  describe("formatQtyUnit", () => {
    it("« 1 rouleau » / « 3 rouleaux »", () => {
      expect(formatQtyUnit(1, "rouleaux")).toBe("1 rouleau");
      expect(formatQtyUnit(3, "rouleau")).toBe("3 rouleaux");
      expect(formatQtyUnit(0, "flacons")).toBe("0 flacon");
    });

    it("garde les abréviations telles quelles", () => {
      expect(formatQtyUnit(2, "L")).toBe("2 L");
      expect(formatQtyUnit(5, "kg")).toBe("5 kg");
    });

    it("n'affiche que la quantité sans unité", () => {
      expect(formatQtyUnit(3, null)).toBe("3");
      expect(formatQtyUnit(3, undefined)).toBe("3");
      expect(formatQtyUnit(3, "   ")).toBe("3");
    });
  });
});
