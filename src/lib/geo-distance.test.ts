import { describe, expect, it } from "vitest";
import { POINTAGE_DISTANCE_WARN_M, formatDistance, haversineMeters } from "./geo-distance";

describe("Distance GPS du pointage", () => {
  it("calcule Paris → Lyon à environ 392 km", () => {
    const d = haversineMeters(48.8566, 2.3522, 45.764, 4.8357);
    expect(d).toBeGreaterThan(390_000);
    expect(d).toBeLessThan(395_000);
  });

  it("vaut 0 au même point et est symétrique", () => {
    expect(haversineMeters(48.85, 2.35, 48.85, 2.35)).toBe(0);
    expect(haversineMeters(48.85, 2.35, 48.86, 2.36)).toBe(haversineMeters(48.86, 2.36, 48.85, 2.35));
  });

  it("renvoie un entier (mètres arrondis)", () => {
    expect(Number.isInteger(haversineMeters(48.85, 2.35, 48.86, 2.36))).toBe(true);
  });

  it("formate en mètres sous 1 km, en km (1 décimale) au-delà", () => {
    expect(formatDistance(150)).toBe("150 m");
    expect(formatDistance(999)).toBe("999 m");
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1540)).toBe("1.5 km");
  });

  it("alerte au-delà de 200 m du logement", () => {
    expect(POINTAGE_DISTANCE_WARN_M).toBe(200);
  });
});
