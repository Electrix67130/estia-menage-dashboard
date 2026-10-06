import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createQueryWrapper } from "@/test/query";
import { apiFetch } from "@/lib/api";
import { useMarkTabViewed, type UnreadCounts, type UnreadSummary } from "./useMenageViews";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const counts: UnreadCounts = {
  comments: 2,
  comments_steps: 0,
  photos: 1,
  documents: 0,
  emergencies: 0,
  emergencies_claim: 0,
  unread_step_ids: [],
  unread_emergency_ids: [],
};

// Les données sont posées dans le cache sans observateur : il faut un gcTime
// non nul pour qu'elles ne soient pas ramassées avant l'assertion.
const wrapper = () =>
  createQueryWrapper(new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } }));

const summary: UnreadSummary = {
  by_menage: { m1: 3, m2: 1 },
  by_organization: { org: 4 },
  by_type: { menage: 4 },
};

describe("Badges « non lus » — mise à jour optimiste à l'ouverture d'un onglet", () => {
  it("décrémente le compteur de la prestation du nombre de non-lus de l'onglet", async () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {})); // la requête reste en vol
    const { Wrapper, qc } = wrapper();
    qc.setQueryData(["menage-views", "unread", "m1"], counts);
    qc.setQueryData(["menage-views", "unread-summary"], summary);

    const { result } = renderHook(() => useMarkTabViewed(), { wrapper: Wrapper });
    act(() => result.current.mutate({ menage_id: "m1", tab: "comments" }));

    await waitFor(() => {
      expect(qc.getQueryData<UnreadCounts>(["menage-views", "unread", "m1"])?.comments).toBe(0);
    });
    const next = qc.getQueryData<UnreadSummary>(["menage-views", "unread-summary"]);
    expect(next?.by_menage).toEqual({ m1: 1, m2: 1 });
    expect(next?.by_menage.m1).toBe(1);
  });

  it("retire la prestation du badge quand plus rien n'est à lire", async () => {
    vi.mocked(apiFetch).mockReturnValue(new Promise(() => {}));
    const { Wrapper, qc } = wrapper();
    qc.setQueryData(["menage-views", "unread", "m2"], { ...counts, comments: 0, photos: 1 });
    qc.setQueryData(["menage-views", "unread-summary"], summary);

    const { result } = renderHook(() => useMarkTabViewed(), { wrapper: Wrapper });
    act(() => result.current.mutate({ menage_id: "m2", tab: "photos" }));

    await waitFor(() => {
      expect(qc.getQueryData<UnreadSummary>(["menage-views", "unread-summary"])?.by_menage).toEqual({ m1: 3 });
    });
  });

  it("un onglet sans non-lus ne touche pas au résumé", async () => {
    vi.mocked(apiFetch).mockResolvedValue(undefined);
    const { Wrapper, qc } = wrapper();
    qc.setQueryData(["menage-views", "unread", "m1"], counts);
    qc.setQueryData(["menage-views", "unread-summary"], summary);

    const { result } = renderHook(() => useMarkTabViewed(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ menage_id: "m1", tab: "documents" });
    });
    expect(qc.getQueryData<UnreadSummary>(["menage-views", "unread-summary"])?.by_menage).toEqual(summary.by_menage);
    expect(apiFetch).toHaveBeenCalledWith("/menage-views", { method: "POST", body: { menage_id: "m1", tab: "documents" } });
  });

  it("restaure l'état précédent si l'API refuse", async () => {
    vi.mocked(apiFetch).mockRejectedValue(new Error("boom"));
    const { Wrapper, qc } = wrapper();
    qc.setQueryData(["menage-views", "unread", "m1"], counts);
    qc.setQueryData(["menage-views", "unread-summary"], summary);

    const { result } = renderHook(() => useMarkTabViewed(), { wrapper: Wrapper });
    await act(async () => {
      await result.current.mutateAsync({ menage_id: "m1", tab: "comments" }).catch(() => undefined);
    });
    expect(qc.getQueryData<UnreadCounts>(["menage-views", "unread", "m1"])).toEqual(counts);
    expect(qc.getQueryData<UnreadSummary>(["menage-views", "unread-summary"])).toEqual(summary);
  });
});
