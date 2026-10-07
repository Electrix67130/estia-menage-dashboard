import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { createQueryWrapper } from "@/test/query";
import { apiFetch } from "@/lib/api";
import ReportCommentModal, { buildReportPayload, commentExcerpt } from "./ReportCommentModal";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const apiFetchMock = vi.mocked(apiFetch);
const COMMENT = { id: "c0ffee00-0000-4000-8000-000000000001", content: "Le linge n'était pas prêt, encore une fois !" };

function renderModal() {
  const { Wrapper } = createQueryWrapper();
  const onClose = vi.fn();
  render(
    <Wrapper>
      <ReportCommentModal open onClose={onClose} comment={COMMENT} />
    </Wrapper>,
  );
  return { onClose };
}

const submitButton = () => screen.getByRole("button", { name: "Envoyer le signalement" });
const lastBody = () => apiFetchMock.mock.calls.at(-1)?.[1]?.body as Record<string, unknown>;

beforeEach(() => {
  apiFetchMock.mockResolvedValue({ id: "f1" });
  window.history.replaceState({}, "", "/menages/m1");
});

describe("commentExcerpt", () => {
  it("garde les 30 premiers caractères et signale la coupe", () => {
    expect(commentExcerpt("court")).toBe("court");
    expect(commentExcerpt("a".repeat(30))).toBe("a".repeat(30));
    expect(commentExcerpt("a".repeat(31))).toBe(`${"a".repeat(30)}…`);
    expect(commentExcerpt("  deux\n lignes  ")).toBe("deux lignes");
  });
});

describe("buildReportPayload", () => {
  const base = {
    reasonLabel: "Harcèlement",
    comment: COMMENT,
    fallbackMessage: 'Commentaire signalé : "Le linge n\'était pas prêt, enc…"',
    locale: "fr",
    screen: "/menages/m1",
  };

  it("envoie un `report` ciblant le commentaire, avec les précisions comme message", () => {
    expect(buildReportPayload({ ...base, details: "  Il s'en prend à moi à chaque prestation.  " })).toEqual({
      type: "report",
      subject: "Harcèlement",
      message: "Il s'en prend à moi à chaque prestation.",
      target_type: "comment",
      target_id: COMMENT.id,
      platform: "web",
      screen: "/menages/m1",
      locale: "fr",
    });
  });

  it("sans précisions → message de repli citant le commentaire (≥ 10 caractères)", () => {
    const p = buildReportPayload({ ...base, details: "" });
    expect(p.message).toBe(base.fallbackMessage);
    expect(p.message.length).toBeGreaterThanOrEqual(10);
  });

  it("précisions trop courtes pour l'API → repli, précisions conservées à la suite", () => {
    expect(buildReportPayload({ ...base, details: "grave" }).message).toBe(`${base.fallbackMessage} — grave`);
  });
});

describe("ReportCommentModal", () => {
  it("exige un motif avant d'envoyer", async () => {
    renderModal();
    expect(submitButton()).toBeDisabled();
    await userEvent.click(screen.getByLabelText("Propos inappropriés"));
    expect(submitButton()).toBeEnabled();
  });

  it("poste le signalement conforme et prévient l'utilisateur", async () => {
    const { onClose } = renderModal();
    await userEvent.click(screen.getByLabelText("Harcèlement"));
    await userEvent.type(screen.getByLabelText(/Précisions/), "Il s'en prend à moi à chaque prestation.");
    await userEvent.click(submitButton());

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(apiFetchMock.mock.calls[0][0]).toBe("/feedbacks");
    expect(apiFetchMock.mock.calls[0][1]?.method).toBe("POST");
    expect(lastBody()).toEqual({
      type: "report",
      subject: "Harcèlement",
      message: "Il s'en prend à moi à chaque prestation.",
      target_type: "comment",
      target_id: COMMENT.id,
      platform: "web",
      screen: "/menages/m1",
      locale: "fr",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(
      "Signalement envoyé. Les administrateurs ont été prévenus.",
    );
  });

  it("sans précisions, le message cite les 30 premiers caractères du commentaire", async () => {
    renderModal();
    await userEvent.click(screen.getByLabelText("Autre"));
    await userEvent.click(submitButton());

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(lastBody()).toMatchObject({
      subject: "Autre",
      message: 'Commentaire signalé : "Le linge n\'était pas prêt, enc…"',
    });
  });
});
