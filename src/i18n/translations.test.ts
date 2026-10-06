import { describe, expect, it } from "vitest";
import { LOCALES, TRANSLATIONS, pluralKey, translate, translatePlural } from "./translations";

describe("Traductions (translate)", () => {
  it("traduit dans la langue demandée", () => {
    expect(translate("fr", "common.cancel")).toBe("Annuler");
    expect(translate("en", "common.cancel")).toBe("Cancel");
  });

  it("remplace les variables {name}", () => {
    expect(translate("fr", "dashboard.greeting", { name: "Julien" })).toBe("Bonjour Julien 👋");
    expect(translate("en", "dashboard.greeting", { name: "Julien" })).toBe("Hi Julien 👋");
  });

  it("retombe sur le français quand la clé manque dans la langue, puis sur la clé elle-même", () => {
    const de = TRANSLATIONS.de as Record<string, string | undefined>;
    const saved = de["common.cancel"];
    delete de["common.cancel"];
    try {
      expect(translate("de", "common.cancel")).toBe(TRANSLATIONS.fr["common.cancel"]);
    } finally {
      de["common.cancel"] = saved;
    }
    expect(translate("fr", "cle.inconnue")).toBe("cle.inconnue");
  });

  it("accorde les pluriels selon la convention `xxx` / `xxxPlural` (0 et 1 au singulier en français)", () => {
    expect(pluralKey("dispo.available", 0, "fr")).toBe("dispo.available");
    expect(pluralKey("dispo.available", 1, "fr")).toBe("dispo.available");
    expect(pluralKey("dispo.available", 2, "fr")).toBe("dispo.availablePlural");
    expect(pluralKey("dispo.available", 0, "en")).toBe("dispo.availablePlural");
    expect(translatePlural("fr", "dispo.memberCount", 3)).toBe("3 membres");
    expect(translatePlural("en", "dispo.memberCount", 1)).toBe("1 member");
  });

  it("propose 8 langues, chacune avec un dictionnaire", () => {
    expect(LOCALES.map((l) => l.code)).toEqual(["fr", "en", "de", "es", "it", "pt", "tr", "pl"]);
    for (const l of LOCALES) expect(Object.keys(TRANSLATIONS[l.code]).length).toBeGreaterThan(400);
  });
});

describe("Parité des clés entre langues", () => {
  it("l'anglais couvre toutes les clés françaises", () => {
    const missing = Object.keys(TRANSLATIONS.fr).filter((k) => !(k in TRANSLATIONS.en));
    expect(missing).toEqual([]);
  });

  it("chaque langue couvre toutes les clés françaises", () => {
    for (const l of LOCALES) {
      const missing = Object.keys(TRANSLATIONS.fr).filter((k) => !(k in TRANSLATIONS[l.code]));
      expect(missing, `clés manquantes en ${l.code}`).toEqual([]);
    }
  });

  it("aucune valeur vide, et les mêmes variables {var} dans chaque langue", () => {
    const vars = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort().join(",");
    for (const l of LOCALES) {
      for (const [k, v] of Object.entries(TRANSLATIONS[l.code])) {
        expect(v.trim(), `${l.code}.${k} vide`).not.toBe("");
        expect(vars(v), `${l.code}.${k} : variables ≠ fr`).toBe(vars(TRANSLATIONS.fr[k] ?? ""));
      }
    }
  });

  it("aucune langue n'a de clé orpheline absente du français", () => {
    for (const l of LOCALES) {
      const extra = Object.keys(TRANSLATIONS[l.code]).filter((k) => !(k in TRANSLATIONS.fr));
      expect(extra, `clés orphelines en ${l.code}`).toEqual([]);
    }
  });
});
