import { deals, marketById } from "./content";
import type { AssetCategory, GameState, Player } from "./types";
export const BARGAIN_THRESHOLD = 5000;
// Shared offers use repeatable small/large assets so everyone can buy the same
// investment. Unique Fast Track businesses remain board-space opportunities.
export function discountCandidates(s: GameState, category: AssetCategory) {
  if (!s.marketState || s.marketState.indices[category] >= BARGAIN_THRESHOLD)
    return [];
  return deals.filter(
    (c) =>
      c.category === category &&
      c.tier !== "fast" &&
      (!c.source || s.config.adaptedCards),
  );
}
export function canBargainBuy(
  s: GameState,
  p: Player,
  category: AssetCategory,
) {
  const d = s.decision;
  return !!(
    d?.kind === "discount" &&
    s.phase === "decision" &&
    !s.pending &&
    !p.eliminated &&
    !p.bankrupt &&
    !p.skip &&
    s.players[d.responder].id === p.id &&
    marketById(d.market)?.category === category &&
    discountCandidates(s, category).some((c) => c.id === d.card)
  );
}
