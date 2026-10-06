import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query";
import { apiFetch } from "@/lib/api";
import { useMenages } from "./useMenages";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);
const empty = { data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 } };

/** Paramètres de la requête `/menages?…` effectivement envoyée. */
async function queryOf(params: Parameters<typeof useMenages>[0], options?: Parameters<typeof useMenages>[1]) {
  const { Wrapper } = createQueryWrapper();
  renderHook(() => useMenages(params, options), { wrapper: Wrapper });
  await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
  const url = apiFetchMock.mock.calls[0][0];
  expect(url.startsWith("/menages?")).toBe(true);
  return new URLSearchParams(url.slice("/menages?".length));
}

beforeEach(() => {
  apiFetchMock.mockResolvedValue(empty);
});

describe("useMenages — construction de la requête", () => {
  it("par défaut : seulement limit=100", async () => {
    const qs = await queryOf({});
    expect(Array.from(qs.keys())).toEqual(["limit"]);
    expect(qs.get("limit")).toBe("100");
  });

  it("filtre « Non assigné » → unassigned=true", async () => {
    const qs = await queryOf({ unassigned: true, type: "menage" });
    expect(qs.get("unassigned")).toBe("true");
    expect(qs.get("type")).toBe("menage");
  });

  it("filtre « Qui est dispo ? » → availability", async () => {
    const qs = await queryOf({ availability: "no_response" });
    expect(qs.get("availability")).toBe("no_response");
  });

  it("historique presta → assigned=me", async () => {
    const qs = await queryOf({ closed: true, assigned: "me" });
    expect(qs.get("assigned")).toBe("me");
    expect(qs.get("closed")).toBe("true");
  });

  it("historique : stale_before pour remonter les oubliées, closed=false pour la worklist", async () => {
    const qs = await queryOf({ closed: false, stale_before: "2026-09-05" });
    expect(qs.get("closed")).toBe("false");
    expect(qs.get("stale_before")).toBe("2026-09-05");
  });

  it("filtres superviseur et pagination : manager=me, page, from/to, logement, prestataire, validated", async () => {
    const qs = await queryOf({
      managerOnly: true,
      page: 2,
      limit: 50,
      from: "2026-10-01",
      to: "2026-10-31",
      logement_id: "l1",
      prestataire_user_id: "p1",
      validated: false,
      status: "termine",
    });
    expect(qs.get("manager")).toBe("me");
    expect(qs.get("page")).toBe("2");
    expect(qs.get("limit")).toBe("50");
    expect(qs.get("from")).toBe("2026-10-01");
    expect(qs.get("to")).toBe("2026-10-31");
    expect(qs.get("logement_id")).toBe("l1");
    expect(qs.get("prestataire_user_id")).toBe("p1");
    expect(qs.get("validated")).toBe("false");
    expect(qs.get("status")).toBe("termine");
  });

  it("n'appelle pas l'API quand enabled=false", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useMenages({}, { enabled: false }), { wrapper: Wrapper });
    await new Promise((r) => setTimeout(r, 20));
    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });
});
