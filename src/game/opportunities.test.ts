import { createLegacyGame as createGame } from "../../tests/legacyGame";
import { describe, it, expect } from "vitest";
import { smallDeals, smallDealCopies } from "./content";
import { reduceGame } from "./engine";
import { validateSave } from "./storage";
import type { GameState } from "./types";

function drawSmall(state: GameState) {
  const prepared: GameState = {
    ...state,
    phase: "decision",
    decision: { kind: "opportunity", owner: state.current, transferred: false },
  };
  return reduceGame(prepared, { type: "DRAW", tier: "small" });
}
function drawnCard(state: GameState) {
  const id = state.decision?.kind === "opportunity" && state.decision.card;
  return smallDeals.find((c) => c.id === id)!;
}
function assertCopies(state: GameState, early: boolean) {
  const all = [...state.decks.small, drawnCard(state).id];
  const enabled = smallDeals.filter(
    (c) => state.config.adaptedCards || !c.source,
  );
  expect(new Set(all).size).toBe(enabled.length);
  for (const card of enabled)
    expect(all.filter((id) => id === card.id).length).toBe(
      smallDealCopies(card, early),
    );
}

describe("early opportunity mix", () => {
  it("boosts only stocks and small businesses without included debt or financing costs", () => {
    const business = smallDeals.find((c) => c.id === "sb0")!,
      stock = smallDeals.find((c) => c.id === "ss0")!,
      property = smallDeals.find((c) => c.id === "sp0")!;
    expect(smallDealCopies(stock, true)).toBe(3);
    expect(smallDealCopies(business, true)).toBe(3);
    expect(smallDealCopies({ ...business, mortgage: 100000 }, true)).toBe(1);
    expect(smallDealCopies({ ...business, financing: 1000 }, true)).toBe(1);
    expect(smallDealCopies({ ...business, tier: "large" }, true)).toBe(1);
    expect(smallDealCopies(property, true)).toBe(1);
    expect(
      smallDealCopies({ ...property, mortgage: 0, financing: 0 }, true),
    ).toBe(1);
    expect(smallDealCopies(business, false)).toBe(1);
    expect(smallDealCopies(stock, false)).toBe(1);
  });
  for (const adaptedCards of [false, true]) {
    it(`uses three copies per stock and debt-free small business, with adaptations ${adaptedCards ? "on" : "off"}`, () => {
      const s = createGame({ adaptedCards });
      const enabled = smallDeals.filter((c) => adaptedCards || !c.source);
      expect(s.smallDeckStage).toBe("early");
      for (const c of enabled)
        expect(s.decks.small.filter((id) => id === c.id).length).toBe(
          c.category === "stock" ||
            (c.category === "business" && c.mortgage === 0 && c.financing === 0)
            ? 3
            : 1,
        );
      expect(validateSave(JSON.parse(JSON.stringify(s))).decks).toEqual(
        s.decks,
      );
      if (!adaptedCards)
        expect(s.decks.small.some((id) => id.startsWith("enc-"))).toBe(false);
    });
    it(`boosts both stocks and businesses over 20 draws across common seeds, adaptations ${adaptedCards}`, () => {
      const counts = {
        early: { stock: 0, business: 0, property: 0 },
        normal: { stock: 0, business: 0, property: 0 },
      };
      for (let sample = 1; sample <= 100; sample++) {
        const initial = createGame({
          seed: (sample * 2654435761) >>> 0,
          adaptedCards,
          opponents: 1,
        });
        for (const mode of ["early", "normal"] as const) {
          let s = { ...initial, round: mode === "early" ? 1 : 11 };
          for (let draw = 0; draw < 20; draw++) {
            s = drawSmall(s);
            counts[mode][drawnCard(s).category]++;
          }
        }
      }
      expect(counts.early.stock).toBeGreaterThan(counts.normal.stock + 80);
      expect(counts.early.business).toBeGreaterThan(
        counts.normal.business + 80,
      );
      expect(counts.early.property).toBeLessThan(counts.normal.property - 240);
    }, 15000);
    it(`keeps the boost through round 10 and removes every extra copy on round 11, adaptations ${adaptedCards}`, () => {
      let s = createGame({ adaptedCards });
      s.round = 10;
      s.decks.small = [];
      s = drawSmall(s);
      expect(s.smallDeckStage).toBe("early");
      assertCopies(s, true);
      const untouched = {
        large: s.decks.large,
        market: s.decks.market,
        expense: s.decks.expense,
      };
      s.round = 11;
      s = drawSmall(s);
      expect(s.smallDeckStage).toBe("normal");
      assertCopies(s, false);
      expect({
        large: s.decks.large,
        market: s.decks.market,
        expense: s.decks.expense,
      }).toEqual(untouched);
      s.decks.small = [];
      s = drawSmall(s);
      assertCopies(s, false);
    });
  }
  it("uses the same deck and random state for humans and NPCs", () => {
    const human = createGame({ opponents: 1, seed: 94 });
    const npc = { ...human, current: 1 };
    const a = drawSmall(human),
      b = drawSmall(npc);
    expect(drawnCard(a).id).toBe(drawnCard(b).id);
    expect(a.rng).toBe(b.rng);
    expect(a.decks).toEqual(b.decks);
  });
  it("resumes the next card and roll identically before, during and after the cutoff", () => {
    for (const round of [1, 10, 11, 12]) {
      let s = createGame({ seed: 852, adaptedCards: true });
      s.round = round;
      for (let i = 0; i < 5; i++) s = drawSmall(s);
      const copy = validateSave(JSON.parse(JSON.stringify(s)));
      const a = drawSmall(s),
        b = drawSmall(copy);
      expect(a).toEqual(b);
      a.phase = b.phase = "roll";
      a.decision = b.decision = null;
      expect(reduceGame(a, { type: "ROLL" })).toEqual(
        reduceGame(b, { type: "ROLL" }),
      );
    }
  });
  it("preserves a legacy save until its next draw, then adopts the correct mix", () => {
    const s = createGame({ seed: 19 });
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.smallDeckStage;
    legacy.decks.small = [...new Set(legacy.decks.small)];
    const loaded = validateSave(legacy);
    expect(loaded.smallDeckStage).toBe("normal");
    expect(loaded.decks.small).toEqual(legacy.decks.small);
    expect(loaded.rng).toBe(legacy.rng);
    expect(loaded.players).toEqual(legacy.players);
    const next = drawSmall(loaded);
    assertCopies(next, true);
    expect(next).toEqual(drawSmall(legacy));
  });
  it.each([11, 15, 20])(
    "replaces an older save's boosted deck on its next small draw in round %s",
    (round) => {
      const s = createGame({ seed: 94, adaptedCards: true });
      s.round = round;
      const loaded = validateSave(JSON.parse(JSON.stringify(s)));
      expect(loaded.decks).toEqual(s.decks);
      expect(loaded.rng).toBe(s.rng);
      const next = drawSmall(loaded);
      expect(next.smallDeckStage).toBe("normal");
      assertCopies(next, false);
      expect(next.players).toEqual(s.players);
    },
  );
  it("does not replace an already-revealed opportunity or pending worksheet", () => {
    const s = createGame({ accounting: "manual" });
    s.decks.small = [...new Set(s.decks.small)];
    s.smallDeckStage = "normal";
    s.phase = "decision";
    s.decision = {
      kind: "opportunity",
      owner: 0,
      transferred: false,
      card: "sp0",
    };
    const pending = reduceGame(s, { type: "BORROW", amount: 100000 });
    const loaded = validateSave(JSON.parse(JSON.stringify(pending)));
    expect(loaded.decision).toEqual(s.decision);
    expect(loaded.pending).toEqual(pending.pending);
    expect(loaded.decks).toEqual(s.decks);
  });
  it("rejects excess copies and invalid deck stages without accepting duplicate properties", () => {
    for (const id of ["sp0", "ss0", "sb0"]) {
      const s = createGame();
      s.decks.small.push(id);
      expect(() => validateSave(s)).toThrow();
    }
    const normal = createGame();
    normal.smallDeckStage = "normal";
    expect(() => validateSave(normal)).toThrow();
    const s = createGame();
    s.decks.large.push(s.decks.large[0]);
    expect(() => validateSave(s)).toThrow();
    expect(() =>
      validateSave({ ...createGame(), smallDeckStage: "boosted" }),
    ).toThrow();
  });
});
