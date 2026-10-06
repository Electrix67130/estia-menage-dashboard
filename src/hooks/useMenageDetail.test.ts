import { describe, expect, it } from "vitest";
import { menageSourceLabel } from "./useMenageDetail";

describe("Origine d'une prestation (menageSourceLabel)", () => {
  it("« Manuel » sans source externe", () => {
    expect(menageSourceLabel(null)).toBe("Manuel");
    expect(menageSourceLabel(undefined)).toBe("Manuel");
    expect(menageSourceLabel("")).toBe("Manuel");
  });

  it("reconnaît les plateformes derrière le préfixe cal_", () => {
    expect(menageSourceLabel("cal_airbnb")).toBe("Airbnb");
    expect(menageSourceLabel("cal_booking")).toBe("Booking");
    expect(menageSourceLabel("cal_vrbo")).toBe("Vrbo");
    expect(menageSourceLabel("cal_ical")).toBe("iCal");
    expect(menageSourceLabel("airbnb")).toBe("Airbnb");
  });

  it("« Externe » pour une source inconnue", () => {
    expect(menageSourceLabel("cal_passpass")).toBe("Externe");
  });
});
