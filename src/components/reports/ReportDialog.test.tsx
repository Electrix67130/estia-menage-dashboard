import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createQueryWrapper } from "@/test/query";
import { apiFetch, ApiError } from "@/lib/api";
import ReportDialog, { buildReportInput, type ReportTargetRef } from "./ReportDialog";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const apiFetchMock = vi.mocked(apiFetch);
const TARGET: ReportTargetRef = {
  type: "comment",
  id: "c0ffee00-0000-4000-8000-000000000001",
  label: "Sofia Martin : Le linge n'était pas prêt",
};

function renderDialog(target: ReportTargetRef | null = TARGET) {
  const { Wrapper } = createQueryWrapper();
  const onClose = vi.fn();
  render(
    <Wrapper>
      <ReportDialog target={target} onClose={onClose} />
    </Wrapper>,
  );
  return { onClose };
}

const submitButton = () => screen.getByRole("button", { name: "Envoyer le signalement" });

beforeEach(() => {
  apiFetchMock.mockResolvedValue({ id: "r1" });
});

describe("buildReportInput", () => {
  it("vise la cible avec le motif, et garde la précision nettoyée", () => {
    expect(buildReportInput(TARGET, "harassment", "  Il s'en prend à moi.  ")).toEqual({
      target_type: "comment",
      target_id: TARGET.id,
      reason: "harassment",
      comment: "Il s'en prend à moi.",
    });
  });

  it("une précision faite d'espaces n'est pas envoyée", () => {
    expect(buildReportInput(TARGET, "other", "   ")).not.toHaveProperty("comment");
  });
});

describe("ReportDialog", () => {
  it("fermée sans cible", () => {
    renderDialog(null);
    expect(screen.queryByRole("button", { name: "Envoyer le signalement" })).toBeNull();
  });

  it("montre ce qui est signalé, et le titre selon le type", () => {
    renderDialog({ type: "user", id: "u1", label: "Sofia Martin" });
    expect(screen.getByText("Signaler ce membre")).toBeInTheDocument();
    expect(screen.getByText("Sofia Martin")).toBeInTheDocument();
    expect(screen.getByText(/jamais à la personne concernée/)).toBeInTheDocument();
  });

  it("exige un motif, puis envoie POST /reports et se ferme", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    expect(submitButton()).toBeDisabled();

    await user.click(screen.getByLabelText("Hors sujet"));
    await user.type(screen.getByRole("textbox"), "Spam répété");
    await user.click(submitButton());

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith("/reports", {
      method: "POST",
      body: { target_type: "comment", target_id: TARGET.id, reason: "off_topic", comment: "Spam répété" },
    });
    expect(toast.success).toHaveBeenCalled();
  });

  it("reste ouverte et prévient en cas d'erreur", async () => {
    apiFetchMock.mockRejectedValueOnce(new ApiError(404, "Cible introuvable", null));
    const user = userEvent.setup();
    const { onClose } = renderDialog();
    await user.click(screen.getByLabelText("Harcèlement"));
    await user.click(submitButton());

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Cible introuvable"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
