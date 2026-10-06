import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query";
import { apiFetch } from "@/lib/api";
import { logementLabel, prestataireLabel, useCalendarMenages } from "./useCalendarMenages";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

describe("Libellé d'un logement", () => {
  it("nom, sinon adresse + ville, sinon « Logement inconnu »", () => {
    expect(logementLabel({ logement_name: "Villa Rosa", logement_address: "1 rue A", logement_city: "Nice" })).toBe("Villa Rosa");
    expect(logementLabel({ logement_name: null, logement_address: "1 rue A", logement_city: "Nice" })).toBe("1 rue A Nice");
    expect(logementLabel({ logement_name: null, logement_address: null, logement_city: "Nice" })).toBe("Nice");
    expect(logementLabel({ logement_name: "", logement_address: null, logement_city: null })).toBe("Logement inconnu");
  });
});

describe("Libellé du prestataire", () => {
  it("« Non assigné » sans prestataire, sinon prénom nom, sinon tiret", () => {
    expect(prestataireLabel({ prestataire_user_id: null, prestataire_first_name: "X", prestataire_last_name: "Y" })).toBe("Non assigné");
    expect(prestataireLabel({ prestataire_user_id: "u", prestataire_first_name: "Ana", prestataire_last_name: "Lopez" })).toBe("Ana Lopez");
    expect(prestataireLabel({ prestataire_user_id: "u", prestataire_first_name: "Ana", prestataire_last_name: null })).toBe("Ana");
    expect(prestataireLabel({ prestataire_user_id: "u", prestataire_first_name: null, prestataire_last_name: null })).toBe("—");
  });
});

describe("useCalendarMenages — requête du mois", () => {
  it("envoie from/to, limit=200 et manager=me pour un superviseur", async () => {
    const apiFetchMock = vi.mocked(apiFetch).mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 200, totalPages: 0 } });
    const { Wrapper } = createQueryWrapper();
    renderHook(() => useCalendarMenages({ from: "2026-10-01", to: "2026-10-31", managerOnly: true }), { wrapper: Wrapper });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const qs = new URLSearchParams(apiFetchMock.mock.calls[0][0].split("?")[1]);
    expect(qs.get("from")).toBe("2026-10-01");
    expect(qs.get("to")).toBe("2026-10-31");
    expect(qs.get("limit")).toBe("200");
    expect(qs.get("manager")).toBe("me");
  });
});
