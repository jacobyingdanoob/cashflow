// Regression fixtures for pre-market-overhaul saves. New-rule tests use createGame directly.
import { createGame } from "../src/game/engine";
import { markets } from "../src/game/content";
import type { GameConfig } from "../src/game/types";
export function createLegacyGame(options: Partial<GameConfig> = {}) {
  const s = createGame({ opponents: 3, ...options });
  delete s.marketState;
  s.decks.market = markets
    .filter((c) => s.config.adaptedCards || !c.source)
    .map((c) => c.id);
  return s;
}
