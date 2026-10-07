import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryWrapper } from "@/test/query";
import { ApiError, apiFetch } from "@/lib/api";
import ReportTargetInfo from "./ReportTargetInfo";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiFetch: vi.fn(),
}));

const apiFetchMock = vi.mocked(apiFetch);
const TARGET = "c0ffee00-0000-4000-8000-000000000001";

function renderInfo(props: Parameters<typeof ReportTargetInfo>[0]) {
  const { Wrapper } = createQueryWrapper();
  return render(
    <Wrapper>
      <ReportTargetInfo {...props} />
    </Wrapper>,
  );
}

beforeEach(() => {
  apiFetchMock.mockReset();
});

describe("ReportTargetInfo", () => {
  it("résout le commentaire et propose un lien vers la prestation", async () => {
    apiFetchMock.mockResolvedValue({ id: TARGET, menage_id: "m42", content: "Texte signalé" });
    renderInfo({ target_type: "comment", target_id: TARGET });

    expect(await screen.findByText("Texte signalé")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voir le commentaire" })).toHaveAttribute("href", "/menages/m42");
    expect(apiFetchMock).toHaveBeenCalledWith(`/comments/${TARGET}`);
  });

  it("commentaire introuvable → affiche l'identifiant et l'explication", async () => {
    apiFetchMock.mockRejectedValue(new ApiError(404, "Comment not found", null));
    renderInfo({ target_type: "comment", target_id: TARGET });

    expect(await screen.findByText(TARGET)).toBeInTheDocument();
    expect(screen.getByText("Contenu introuvable (peut-être déjà supprimé).")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("photo signalée → identifiant seul, sans appel API", () => {
    renderInfo({ target_type: "photo", target_id: TARGET });
    expect(screen.getByText(TARGET)).toBeInTheDocument();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("ne rend rien pour un bug ou une suggestion", () => {
    const { container } = renderInfo({ target_type: null, target_id: null });
    expect(container).toBeEmptyDOMElement();
  });
});
