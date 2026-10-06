import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query";
import { apiFetch } from "@/lib/api";
import { useDecideReschedule, useRescheduleRequests } from "./useRescheduleRequests";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);

beforeEach(() => {
  apiFetchMock.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } });
});

describe("Demandes de report", () => {
  it("liste sans paramètre → /reschedule-requests nu", async () => {
    const { Wrapper } = createQueryWrapper();
    renderHook(() => useRescheduleRequests(), { wrapper: Wrapper });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/reschedule-requests"));
  });

  it("liste des demandes en attente d'une prestation", async () => {
    const { Wrapper } = createQueryWrapper();
    renderHook(() => useRescheduleRequests({ status: "pending", menage_id: "m1", page: 2 }), { wrapper: Wrapper });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    const qs = new URLSearchParams(apiFetchMock.mock.calls[0][0].split("?")[1]);
    expect(qs.get("status")).toBe("pending");
    expect(qs.get("menage_id")).toBe("m1");
    expect(qs.get("page")).toBe("2");
  });

  it("accepter un report déplace la prestation (apply_to_menage) et invalide la liste", async () => {
    const { Wrapper, qc } = createQueryWrapper();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const { result } = renderHook(() => useDecideReschedule(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "r1", decision: "approved", apply_to_menage: true });
    });
    expect(apiFetchMock).toHaveBeenCalledWith("/reschedule-requests/r1/decide", {
      method: "POST",
      body: { decision: "approved", decision_reason: undefined, apply_to_menage: true },
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["reschedule-requests"] });
  });

  it("refuser un report transmet le motif", async () => {
    const { Wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useDecideReschedule(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "r2", decision: "rejected", decision_reason: "Déjà pris" });
    });
    expect(apiFetchMock.mock.calls[0][1]).toMatchObject({ body: { decision: "rejected", decision_reason: "Déjà pris" } });
  });
});
