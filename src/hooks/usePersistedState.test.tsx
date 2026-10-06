import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { usePersistedState } from "./usePersistedState";

describe("Filtres mémorisés (usePersistedState)", () => {
  it("démarre sur la valeur par défaut puis recharge la valeur stockée", async () => {
    window.localStorage.setItem("menages.filter.logement", JSON.stringify("l-42"));
    const { result } = renderHook(() => usePersistedState("menages.filter.logement", ""));
    await waitFor(() => expect(result.current[0]).toBe("l-42"));
  });

  it("persiste chaque changement en JSON", async () => {
    const { result } = renderHook(() => usePersistedState<"list" | "map">("menages.filter.viewMode", "list"));
    act(() => result.current[1]("map"));
    await waitFor(() =>
      expect(window.localStorage.getItem("menages.filter.viewMode")).toBe(JSON.stringify("map")),
    );
    expect(result.current[0]).toBe("map");
  });

  it("ignore une valeur corrompue et garde le défaut", async () => {
    window.localStorage.setItem("archives.filter.period", "{pas du json");
    const { result } = renderHook(() => usePersistedState("archives.filter.period", "month"));
    await new Promise((r) => setTimeout(r, 10));
    expect(result.current[0]).toBe("month");
  });

  it("reset revient au défaut (et le persiste)", async () => {
    window.localStorage.setItem("k", JSON.stringify(5));
    const { result } = renderHook(() => usePersistedState("k", 1));
    await waitFor(() => expect(result.current[0]).toBe(5));
    act(() => result.current[2]());
    expect(result.current[0]).toBe(1);
    await waitFor(() => expect(window.localStorage.getItem("k")).toBe("1"));
  });

  it("deux clés distinctes ne se mélangent pas", async () => {
    const a = renderHook(() => usePersistedState("menages.filter.presta", ""));
    const b = renderHook(() => usePersistedState("check_ins.filter.presta", ""));
    act(() => a.result.current[1]("p1"));
    await waitFor(() => expect(window.localStorage.getItem("menages.filter.presta")).toBe('"p1"'));
    expect(b.result.current[0]).toBe("");
  });
});
