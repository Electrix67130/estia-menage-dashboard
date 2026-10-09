/**
 * Réactions emoji sur les messages d'une prestation (reprises de Buildr).
 *
 * Liste fermée, identique à celle de l'API (`REACTION_EMOJIS` côté serveur) :
 * les compteurs se regroupent par emoji. Toute la rangée affichée en dépend.
 */
export const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Une réaction agrégée : combien de personnes, et si le lecteur en est. */
export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  mine: boolean;
}

/**
 * Ce que deviennent les réactions d'un message quand le lecteur appuie sur un
 * emoji — l'API fait un interrupteur, on l'anticipe pour un retour immédiat :
 * absente → ajoutée (1, à moi) ; à moi seul → retirée ; à moi et d'autres →
 * un de moins ; à d'autres seulement → un de plus, à moi aussi.
 */
export function toggleReactionLocally(
  reactions: ReactionSummary[] | undefined,
  emoji: ReactionEmoji,
): ReactionSummary[] {
  const list = reactions ?? [];
  const current = list.find((r) => r.emoji === emoji);
  if (!current) return [...list, { emoji, count: 1, mine: true }];
  if (current.mine && current.count <= 1) return list.filter((r) => r.emoji !== emoji);
  return list.map((r) =>
    r.emoji !== emoji
      ? r
      : r.mine
        ? { ...r, count: r.count - 1, mine: false }
        : { ...r, count: r.count + 1, mine: true },
  );
}
