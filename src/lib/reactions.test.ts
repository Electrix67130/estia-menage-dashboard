import { describe, expect, it } from "vitest";
import { REACTION_EMOJIS, toggleReactionLocally } from "./reactions";

describe("toggleReactionLocally", () => {
  it("ajoute une réaction absente, à moi", () => {
    expect(toggleReactionLocally(undefined, "👍")).toEqual([{ emoji: "👍", count: 1, mine: true }]);
  });

  it("retire ma réaction quand j'étais seul", () => {
    expect(toggleReactionLocally([{ emoji: "👍", count: 1, mine: true }], "👍")).toEqual([]);
  });

  it("enlève un compte quand d'autres ont aussi réagi", () => {
    expect(toggleReactionLocally([{ emoji: "🔥", count: 3, mine: true }], "🔥")).toEqual([
      { emoji: "🔥", count: 2, mine: false },
    ]);
  });

  it("ajoute un compte à la réaction des autres, et la marque mienne", () => {
    expect(
      toggleReactionLocally(
        [
          { emoji: "👍", count: 2, mine: false },
          { emoji: "😂", count: 1, mine: false },
        ],
        "👍",
      ),
    ).toEqual([
      { emoji: "👍", count: 3, mine: true },
      { emoji: "😂", count: 1, mine: false },
    ]);
  });

  it("propose les 7 emojis de l'API", () => {
    expect(REACTION_EMOJIS).toEqual(["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"]);
  });
});
