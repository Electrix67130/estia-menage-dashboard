import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Comment } from "@/hooks/useMenageCheck";
import CommentMessage from "./CommentMessage";
import { commentReportLabel } from "./CommentsThread";

const base: Comment = {
  id: "c2",
  menage_id: "m1",
  section_id: null,
  author_id: "u2",
  content: "Boîte à clés, @Léa Dubois",
  created_at: "2026-10-09T08:00:00.000Z",
  updated_at: "2026-10-09T08:00:00.000Z",
  first_name: "Sofia",
  last_name: "Martin",
  mentions: [{ user_id: "u1", first_name: "Léa", last_name: "Dubois" }],
  reply_to: { id: "c1", content: "Les clés sont où ?", author_id: "u1", first_name: "Léa", last_name: "Dubois" },
  reactions: [
    { emoji: "👍", count: 2, mine: true },
    { emoji: "🔥", count: 1, mine: false },
  ],
};

function renderMessage(over: Partial<Parameters<typeof CommentMessage>[0]> = {}) {
  const props = {
    comment: base,
    isOwn: false,
    onReply: vi.fn(),
    onReact: vi.fn(),
    onReport: vi.fn(),
    onBlock: vi.fn(),
    onJumpTo: vi.fn(),
    ...over,
  };
  render(
    <ul>
      <CommentMessage {...props} />
    </ul>,
  );
  return props;
}

describe("CommentMessage", () => {
  it("cite le message d'origine ; un clic y remonte", async () => {
    const user = userEvent.setup();
    const props = renderMessage();
    await user.click(screen.getByRole("button", { name: /Les clés sont où/ }));
    expect(props.onJumpTo).toHaveBeenCalledWith("c1");
  });

  it("surligne la mention", () => {
    renderMessage();
    expect(screen.getByText("@Léa Dubois")).toHaveClass("font-semibold");
  });

  it("les pastilles de réaction disent si elles sont miennes et basculent au clic", async () => {
    const user = userEvent.setup();
    const props = renderMessage();
    const pouce = screen.getByRole("button", { name: "👍 — 2" });
    expect(pouce).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "🔥 — 1" })).toHaveAttribute("aria-pressed", "false");
    await user.click(pouce);
    expect(props.onReact).toHaveBeenCalledWith("👍");
  });

  it("le sélecteur propose les 7 emojis et se ferme après un choix", async () => {
    const user = userEvent.setup();
    const props = renderMessage();
    await user.click(screen.getByRole("button", { name: "Réagir" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(7);
    await user.click(within(menu).getByRole("menuitem", { name: "😮" }));
    expect(props.onReact).toHaveBeenCalledWith("😮");
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("répondre, signaler et bloquer sur le message d'un autre", async () => {
    const user = userEvent.setup();
    const props = renderMessage();
    await user.click(screen.getByRole("button", { name: "Répondre" }));
    await user.click(screen.getByRole("button", { name: "Signaler" }));
    await user.click(screen.getByRole("button", { name: "Bloquer Sofia Martin" }));
    expect(props.onReply).toHaveBeenCalled();
    expect(props.onReport).toHaveBeenCalled();
    expect(props.onBlock).toHaveBeenCalled();
  });

  it("ni signaler ni bloquer sur son propre message", () => {
    renderMessage({ isOwn: true, onReport: undefined, onBlock: undefined });
    expect(screen.queryByRole("button", { name: "Signaler" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Bloquer/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Répondre" })).toBeInTheDocument();
  });
});

describe("commentReportLabel", () => {
  it("auteur et début du message, aplati et coupé", () => {
    expect(commentReportLabel({ first_name: "Sofia", last_name: "Martin", content: "Bonjour\n  à tous" })).toBe(
      "Sofia Martin : Bonjour à tous",
    );
    expect(commentReportLabel({ first_name: "A", last_name: "B", content: "x".repeat(130) })).toBe(
      `A B : ${"x".repeat(120)}…`,
    );
  });
});
