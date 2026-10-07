import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createQueryWrapper } from "@/test/query";
import { routerMock } from "@/test/setup";
import { ApiError, apiFetch, setTokens, getAccessToken } from "@/lib/api";
import { AuthProvider } from "@/contexts/AuthContext";
import DeleteAccountModal from "./DeleteAccountModal";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const apiFetchMock = vi.mocked(apiFetch);

function renderModal() {
  const { Wrapper, qc } = createQueryWrapper();
  const onClose = vi.fn();
  render(
    <Wrapper>
      <AuthProvider>
        <DeleteAccountModal open onClose={onClose} />
      </AuthProvider>
    </Wrapper>,
  );
  return { qc, onClose };
}

const confirmButton = () => screen.getByRole("button", { name: "Supprimer définitivement" });
const passwordField = () => screen.getByLabelText("Mot de passe");

beforeEach(() => {
  // Pas de jeton : l'AuthProvider ne charge pas /auth/me, seule la suppression appelle l'API.
  apiFetchMock.mockResolvedValue(undefined);
});

describe("DeleteAccountModal", () => {
  it("désactive la confirmation tant que le mot de passe est vide", async () => {
    renderModal();
    expect(confirmButton()).toBeDisabled();
    await userEvent.type(passwordField(), "secret");
    expect(confirmButton()).toBeEnabled();
  });

  it("appelle DELETE /auth/account avec le mot de passe puis coupe la session locale", async () => {
    setTokens("access", "refresh");
    const { qc } = renderModal();
    qc.setQueryData(["menages"], { data: [] });
    const clear = vi.spyOn(qc, "clear");

    await userEvent.type(passwordField(), "secret");
    await userEvent.click(confirmButton());

    await waitFor(() =>
      expect(apiFetchMock).toHaveBeenCalledWith("/auth/account", {
        method: "DELETE",
        body: { password: "secret" },
        retry: false,
      }),
    );
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
    expect(getAccessToken()).toBeNull();
    expect(clear).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Votre compte a été supprimé");
  });

  it("401 → « Mot de passe incorrect », sans déconnexion", async () => {
    setTokens("access", "refresh");
    // Avec un jeton, l'AuthProvider charge /auth/me : seul /auth/account doit échouer.
    apiFetchMock.mockImplementation((path) =>
      path === "/auth/account"
        ? Promise.reject(new ApiError(401, "Password is incorrect", null))
        : Promise.resolve({ id: "u1" }),
    );
    renderModal();

    await userEvent.type(passwordField(), "oups");
    await userEvent.click(confirmButton());

    expect(await screen.findByText("Mot de passe incorrect")).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe("access");
  });

  it("409 (dernier admin) → affiche le message de l'API", async () => {
    const message = "Vous êtes le seul administrateur d’une organisation qui a encore des membres.";
    apiFetchMock.mockRejectedValueOnce(new ApiError(409, message, { code: "LAST_ADMIN", message }));
    renderModal();

    await userEvent.type(passwordField(), "secret");
    await userEvent.click(confirmButton());

    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(routerMock.replace).not.toHaveBeenCalled();
  });

  it("autre erreur → message générique", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(500, "Internal Server Error", null));
    renderModal();

    await userEvent.type(passwordField(), "secret");
    await userEvent.click(confirmButton());

    expect(
      await screen.findByText("La suppression a échoué. Réessayez dans un instant."),
    ).toBeInTheDocument();
  });
});
