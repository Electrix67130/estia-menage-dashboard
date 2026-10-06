import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_URL, ApiError, apiFetch, clearTokens, getAccessToken, getRefreshToken, setTokens } from "./api";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  clearTokens();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const lastRequest = (i = 0) => {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};

describe("Client API (apiFetch)", () => {
  it("préfixe l'URL, pose la clé d'API et le Bearer, sérialise le corps en JSON", async () => {
    setTokens("access-1", "refresh-1");
    fetchMock.mockResolvedValueOnce(json({ ok: true }));

    const out = await apiFetch<{ ok: boolean }>("/menages", { method: "POST", body: { a: 1 } });

    expect(out).toEqual({ ok: true });
    const { url, init, headers } = lastRequest();
    expect(url).toBe(`${API_URL}/menages`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect(headers["x-api-key"]).toBeTruthy();
    expect(headers["Authorization"]).toBe("Bearer access-1");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("n'envoie pas d'Authorization sans token ni avec skipAuth", async () => {
    fetchMock.mockResolvedValueOnce(json({}));
    await apiFetch("/auth/login", { skipAuth: true });
    expect(lastRequest().headers["Authorization"]).toBeUndefined();

    fetchMock.mockResolvedValueOnce(json({}));
    await apiFetch("/public");
    expect(lastRequest(1).headers["Authorization"]).toBeUndefined();
  });

  it("renvoie undefined sur un 204 et tolère un corps non-JSON", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiFetch("/menages/1")).resolves.toBeUndefined();

    fetchMock.mockResolvedValueOnce(new Response("brut", { status: 200 }));
    await expect(apiFetch("/texte")).resolves.toBe("brut");
  });

  it("lève une ApiError portant le statut et le message renvoyé par l'API", async () => {
    fetchMock.mockResolvedValueOnce(json({ message: "Logement introuvable" }, { status: 404 }));
    const err = await apiFetch("/logements/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(404);
    expect((err as ApiError).message).toBe("Logement introuvable");
    expect((err as ApiError).body).toEqual({ message: "Logement introuvable" });
  });

  it("retente après un 429 en respectant Retry-After", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 429, headers: { "retry-after": "0" } }))
      .mockResolvedValueOnce(json({ data: [] }));

    await expect(apiFetch("/menages")).resolves.toEqual({ data: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("abandonne après 3 nouvelles tentatives sur 429", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "Trop de requêtes" }), {
        status: 429,
        headers: { "retry-after": "0" },
      }),
    );
    const err = await apiFetch("/menages").catch((e: unknown) => e);
    expect((err as ApiError).statusCode).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("sur 401, rafraîchit le token puis rejoue la requête avec le nouveau Bearer", async () => {
    setTokens("vieux", "refresh-1");
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(json({ access_token: "neuf", refresh_token: "refresh-2" }))
      .mockResolvedValueOnce(json({ id: "me" }));

    await expect(apiFetch("/auth/me")).resolves.toEqual({ id: "me" });

    const refresh = lastRequest(1);
    expect(refresh.url).toBe(`${API_URL}/auth/refresh`);
    expect(refresh.init.body).toBe(JSON.stringify({ refresh_token: "refresh-1" }));
    expect(lastRequest(2).headers["Authorization"]).toBe("Bearer neuf");
    expect(getAccessToken()).toBe("neuf");
    expect(getRefreshToken()).toBe("refresh-2");
  });

  it("si le rafraîchissement échoue, vide les tokens et lève un 401", async () => {
    // jsdom ne sait pas naviguer : la redirection vers /login journalise une
    // erreur « not implemented » qu'on neutralise ici.
    vi.spyOn(console, "error").mockImplementation(() => {});
    setTokens("vieux", "refresh-mort");
    fetchMock
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response("", { status: 401 }));

    const err = await apiFetch("/menages").catch((e: unknown) => e);
    expect((err as ApiError).statusCode).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("ne tente pas de refresh quand retry est désactivé", async () => {
    setTokens("vieux", "refresh-1");
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    const err = await apiFetch("/menages", { retry: false }).catch((e: unknown) => e);
    expect((err as ApiError).statusCode).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
