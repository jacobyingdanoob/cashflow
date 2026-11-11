import { describe, expect, it } from "vitest";
import {
  createGame,
  reduceGame,
  assetFromDeal,
  playerFinancials,
} from "./engine";
import {
  marketCategories,
  marketCopies,
  marketShocks,
  nextMarketIndex,
} from "./market";
import {
  marketTrends,
  roundMarketChange,
  cycleMovement,
  cycleRange,
} from "./trends";
import { smallDeals } from "./content";
import { validateSave } from "./storage";
import type { GameState } from "./types";
function nextRound(s: GameState) {
  s = structuredClone(s);
  s.current = s.players.length - 1;
  s.phase = "end";
  s.decision = null;
  s.effects = [];
  return reduceGame(s, { type: "END" });
}
function game() {
  return createGame({ seed: 765, liquidityRisk: false });
}
describe("round-by-round market dynamics", () => {
  it("applies bounded, seeded standby movements once per round", () => {
    let s = game();
    expect(s.marketState!.history).toHaveLength(0);
    for (let round = 2; round <= 4; round++) {
      const before = structuredClone(s.marketState!.indices);
      s = nextRound(s);
      expect(s.round).toBe(round);
      expect(s.marketState!.dynamics!.active).toBeNull();
      const ticks = s.marketState!.history.filter((t) => t.round === round);
      expect(ticks).toHaveLength(3);
      for (const t of ticks) {
        expect(t.source).toBe("drift");
        expect(t.before).toBe(before[t.category]);
        expect(t.after).toBe(
          nextMarketIndex(t.before, 1 + t.changeBps! / 10000),
        );
        const max =
          t.category === "property"
            ? 25
            : t.category === "business"
              ? 100
              : 300;
        expect(Math.abs(t.changeBps!)).toBeLessThanOrEqual(max);
        if (t.category === "stock")
          expect(Math.abs(t.changeBps!)).toBeGreaterThanOrEqual(200);
        expect(roundMarketChange(s, t.category)).toBeCloseTo(
          (t.after / t.before - 1) * 100,
        );
      }
      const count = s.marketState!.history.length;
      s.players[s.current].position = 6;
      s.rng = 1;
      const rolled = reduceGame(s, { type: "ROLL" });
      expect(rolled.marketState!.history).toHaveLength(count);
      validateSave(s);
    }
  });
  it("draws in rounds 5 and 10, compounds three applications, then resumes drift without resetting", () => {
    let s = game();
    const boom = marketTrends.find((c) => c.id === "trend-stock-boom")!;
    s.marketState!.dynamics!.deck = ["trend-stock-correction", boom.id];
    for (let i = 0; i < 3; i++) s = nextRound(s);
    const start = s.marketState!.indices.stock;
    for (const round of [5, 6, 7]) {
      s = nextRound(s);
      expect(s.marketState!.dynamics!.active).toEqual({
        card: boom.id,
        start: 5,
        expires: 8,
      });
      const ticks = s.marketState!.history.filter((t) => t.round === round);
      const stock = ticks.find((t) => t.category === "stock")!;
      expect(stock.changeBps).toBeGreaterThanOrEqual(500);
      expect(stock.changeBps).toBeLessThanOrEqual(1400);
      expect(
        ticks
          .filter((t) => t.category !== "stock")
          .every(
            (t) => t.source === "drift" && t.changeBps === t.fluctuationBps,
          ),
      ).toBe(true);
      expect(stock.changeBps).toBe(
        cycleMovement(
          stock.cycleDrawBps!,
          "stock",
          stock.before,
          stock.fluctuationBps!,
        ),
      );
      validateSave(s);
    }
    expect(s.marketState!.indices.stock).toBeGreaterThan(start * 1.05 ** 3 - 3);
    const peak = s.marketState!.indices.stock;
    s = nextRound(s);
    expect(s.marketState!.dynamics!.active).toBeNull();
    expect(
      s.marketState!.history.find(
        (t) => t.round === 8 && t.category === "stock",
      )!.before,
    ).toBe(peak);
    s = nextRound(nextRound(s));
    expect(s.marketState!.dynamics!.active?.card).toBe(
      "trend-stock-correction",
    );
    expect(s.marketState!.dynamics!.active?.start).toBe(10);
    expect(s.notices.filter((n) => n.kind === "cycle")).toHaveLength(2);
  });
  it("keeps market landings additive to a trend and gives every owner the same shock response", () => {
    let s = game();
    const stock = smallDeals.find((c) => c.category === "stock")!;
    for (const p of s.players)
      p.assets = [assetFromDeal(stock, `holding-${p.id}`, 10)];
    s.marketState!.dynamics!.deck = ["trend-stock-boom"];
    for (let i = 0; i < 4; i++) s = nextRound(s);
    const before = s.marketState!.indices.stock,
      open = s.marketState!.dynamics!.roundOpen.stock;
    s.players[0].position = 1;
    s.rng = 1;
    s.decks.market = ["shock-stock-down-50"];
    const next = reduceGame(s, { type: "ROLL" });
    expect(next.marketState!.indices.stock).toBe(nextMarketIndex(before, 0.5));
    expect(next.marketState!.dynamics!.active).toEqual(
      s.marketState!.dynamics!.active,
    );
    expect(next.decision).toMatchObject({
      kind: "market",
      responder: 0,
      remaining: [1, 2, 3, 4],
    });
    expect(roundMarketChange(next, "stock")).toBeCloseTo(
      (next.marketState!.indices.stock / open - 1) * 100,
    );
    for (const p of next.players)
      expect(
        next.history.filter((h) => h.player === p.id).at(-1)?.values,
      ).toEqual(playerFinancials(next, p));
    validateSave(next);
  });
  it("uses rarer large shocks, a shared weighted deck, and no adapted-card advantage", () => {
    expect(marketShocks).toHaveLength(30);
    for (const category of marketCategories) {
      const shocks = marketShocks.filter((c) => c.category === category);
      const weights = [15, 20, 30, 40, 50].map((size) =>
        marketCopies(
          shocks.find((c) => Math.round((c.multiplier - 1) * 100) === size)!,
        ),
      );
      expect(weights).toEqual([10, 6, 3, 2, 1]);
    }
    expect(createGame({ seed: 42 }).decks.market.sort()).toEqual(
      createGame({ seed: 42, adaptedCards: true }).decks.market.sort(),
    );
    expect(game().decks.market).toHaveLength(132);
  });
  it("resumes pending manual work, trend deck, next drift and next card deterministically", () => {
    let s = game();
    for (let i = 0; i < 4; i++) s = nextRound(s);
    s.config.accounting = "manual";
    s = reduceGame(s, { type: "BORROW", amount: 100000 });
    let restored = validateSave(JSON.parse(JSON.stringify(s)));
    expect(restored.pending).toEqual(s.pending);
    const values = Object.fromEntries(
      s.pending!.fields.map((k) => [
        k,
        String(s.pending!.receipt.after[k] / 100),
      ]),
    );
    s = reduceGame(s, { type: "SUBMIT", values });
    restored = reduceGame(restored, { type: "SUBMIT", values });
    expect(nextRound(restored)).toEqual(nextRound(s));
    s.players[0].position = 1;
    s.rng = 1;
    restored = validateSave(JSON.parse(JSON.stringify(s)));
    expect(reduceGame(restored, { type: "ROLL" })).toEqual(
      reduceGame(s, { type: "ROLL" }),
    );
  });
  it("rejects invalid drift, trend, deck and ticker records", () => {
    const s = nextRound(game());
    for (const corrupt of [
      (v: GameState) => {
        v.marketState!.history[0].changeBps = 10000;
      },
      (v: GameState) => {
        v.marketState!.dynamics!.deck = ["unknown"];
      },
      (v: GameState) => {
        v.marketState!.dynamics!.active = {
          card: "trend-stock-boom",
          start: 2,
          expires: 5,
        };
      },
      (v: GameState) => {
        v.marketState!.dynamics!.roundOpen.stock = 0;
      },
    ]) {
      const bad = structuredClone(s);
      corrupt(bad);
      expect(() => validateSave(bad)).toThrow();
    }
  });
  it("upgrades older market saves without changing holdings, cash, prices or RNG", () => {
    const s = game();
    delete s.marketState!.dynamics;
    s.config.economicCycles = false;
    const restored = validateSave(s);
    expect(restored.players).toEqual(s.players);
    expect(restored.rng).toBe(s.rng);
    expect(restored.marketState!.indices).toEqual(s.marketState!.indices);
    expect(restored.marketState!.dynamics!.lastRound).toBe(s.round);
    expect(restored.decks.market).toEqual([]);
    expect(restored.config.economicCycles).toBe(true);
  });
  it("continues normal drift with economic trends disabled", () => {
    let s = game();
    s.config.economicCycles = false;
    for (let i = 0; i < 7; i++) s = nextRound(s);
    expect(s.marketState!.history.every((t) => t.source === "drift")).toBe(
      true,
    );
    expect(s.marketState!.dynamics!.active).toBeNull();
    validateSave(s);
  });
});
