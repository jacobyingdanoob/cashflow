import { describe, it, expect } from "vitest";
import {
  assetFromDeal,
  createGame,
  playerFinancials,
  reduceGame,
} from "./engine";
import { deals, smallDeals } from "./content";
import { effectiveDeal } from "./economy";
import { discountCandidates, canBargainBuy } from "./bargains";
import { purchaseQuote, marketCategories } from "./market";
import {
  activeDepression,
  cycleMovement,
  cycleRange,
  marketTrends,
} from "./trends";
import { chooseNpc, npcView } from "./npc";
import { validateSave } from "./storage";
import type { AssetCategory, GameState } from "./types";

const game = () => createGame({ seed: 765, liquidityRisk: false });
function shock(
  s: GameState,
  category: AssetCategory,
  direction = "down",
  size = 50,
) {
  s = structuredClone(s);
  s.current = 0;
  s.phase = "roll";
  s.decision = null;
  s.effects = [];
  s.players[0].position = 1;
  s.rng = 1;
  s.decks.market = [`shock-${category}-${direction}-${size}`];
  return reduceGame(s, { type: "ROLL" });
}
function nextRound(s: GameState) {
  s = structuredClone(s);
  s.current = s.players.length - 1;
  s.phase = "end";
  s.decision = null;
  s.effects = [];
  return reduceGame(s, { type: "END" });
}
function turn(s: GameState) {
  s.phase = "end";
  s.decision = null;
  s.effects = [];
  s.current = 0;
  return s;
}
const business = smallDeals.find(
  (c) => c.category === "business" && !c.mortgage,
)!;
const property = smallDeals.find(
  (c) => c.category === "property" && c.mortgage,
)!;
const stock = smallDeals.find((c) => c.category === "stock")!;

describe("cycle strength and stabilizing pressure", () => {
  it("reverses a nominal boom at extreme highs and a correction at extreme lows", () => {
    for (const category of marketCategories) {
      expect(cycleMovement(650, category, 25000, 0)).toBeLessThan(0);
      expect(cycleMovement(-650, category, 4000, 0)).toBeGreaterThan(0);
      expect(cycleMovement(650, category, 15000, 0)).toBeLessThan(
        cycleMovement(650, category, 8000, 0),
      );
    }
  });
  it("keeps cycle movement above ordinary noise and below market-space shocks", () => {
    for (const card of marketTrends)
      for (const category of marketCategories) {
        const range = cycleRange(card, category);
        if (!range) continue;
        for (const base of range)
          for (const index of [1000, 3500, 7500, 10000, 15000, 50000])
            for (const noise of category === "stock"
              ? [-300, 300]
              : category === "business"
                ? [-100, 100]
                : [-25, 25]) {
              const movement = Math.abs(
                cycleMovement(base, category, index, noise),
              );
              expect(movement).toBeGreaterThan(
                category === "stock" ? 300 : category === "business" ? 100 : 25,
              );
              expect(movement).toBeLessThan(1500);
            }
      }
  });
});
function openOffer(s: GameState) {
  while (s.decision?.kind === "market") s = reduceGame(s, { type: "PASS" });
  expect(s.decision?.kind).toBe("discount");
  return s;
}
function discounted(category: AssetCategory) {
  return openOffer(shock(shock(game(), category), category));
}
describe("shared discount offers", () => {
  it("uses a strict 50% threshold and waits for every sale response before drawing", () => {
    let s = shock(game(), "business");
    expect(s.marketState!.indices.business).toBe(5000);
    expect(discountCandidates(s, "business")).toEqual([]);
    expect(s.decision).toBeNull();
    s = shock(s, "business");
    expect(s.decision).toMatchObject({
      kind: "market",
      responder: 0,
      remaining: [1, 2, 3, 4],
    });
    expect(() =>
      reduceGame(s, { type: "BARGAIN_BUY", card: business.id }),
    ).toThrow(/shared discount event/);
    const rng = s.rng;
    for (let i = 0; i < 4; i++) {
      s = reduceGame(s, { type: "PASS" });
      expect(s.decision?.kind).toBe("market");
      expect(s.rng).toBe(rng);
    }
    s = reduceGame(s, { type: "PASS" });
    expect(s.decision).toMatchObject({
      kind: "discount",
      responder: 0,
      remaining: [1, 2, 3, 4],
    });
    expect(s.rng).not.toBe(rng);
    expect(
      deals.find((c) => c.id === (s.decision as { card: string }).card)
        ?.category,
    ).toBe("business");
    validateSave(s);
  });
  it.each(["business", "property", "stock"] as const)(
    "offers every player the same random %s asset at the same price",
    (category) => {
      let s = discounted(category);
      for (const p of s.players) p.cash = 10000000000;
      const decision = s.decision!;
      if (decision.kind !== "discount") throw new Error("Missing offer");
      const card = deals.find((c) => c.id === decision.card)!,
        q = purchaseQuote(
          s,
          effectiveDeal(s, card),
          category === "stock" ? 20 : 1,
        ),
        rng = s.rng;
      for (let i = 0; i < s.players.length; i++) {
        expect(s.decision).toMatchObject({
          kind: "discount",
          card: card.id,
          responder: i,
        });
        const cash = s.players[i].cash;
        s = reduceGame(s, { type: "BARGAIN_BUY", card: card.id, shares: 20 });
        expect(s.players[i].cash).toBe(cash - q.cash);
        expect(s.players[i].assets).toHaveLength(1);
        expect(s.players[i].assets[0]).toMatchObject({
          cardId: card.id,
          mortgage: q.mortgage,
          acquisitionFee: q.fee,
        });
        expect(s.rng).toBe(rng);
        validateSave(s);
      }
      expect(s.decision).toBeNull();
      expect(s.phase).toBe("end");
      expect(() =>
        reduceGame(s, { type: "BARGAIN_BUY", card: card.id }),
      ).toThrow();
    },
  );
  it("lets everyone pass and returns to the original player's turn exactly once", () => {
    let s = discounted("business");
    const current = s.current,
      card = (s.decision as { card: string }).card;
    for (let i = 0; i < s.players.length; i++)
      s = reduceGame(s, { type: "PASS" });
    expect(s.current).toBe(current);
    expect(s.phase).toBe("end");
    expect(s.decision).toBeNull();
    expect(s.players.every((p) => p.assets.length === 0)).toBe(true);
    expect(
      s.history.filter((h) => h.title.startsWith("Passed on discounted"))
        .length,
    ).toBe(s.players.length);
    expect(() => reduceGame(s, { type: "PASS" })).toThrow();
    expect(() => reduceGame(s, { type: "BARGAIN_BUY", card })).toThrow();
    validateSave(s);
  });
  it("blocks catalog purchases, substituted assets, recovery and disabled adaptations", () => {
    let s = turn(shock(shock(game(), "business"), "business"));
    expect(canBargainBuy(s, s.players[0], "business")).toBe(false);
    expect(() =>
      reduceGame(s, { type: "BARGAIN_BUY", card: business.id }),
    ).toThrow();
    s = discounted("business");
    const d = s.decision as Extract<
      GameState["decision"],
      { kind: "discount" }
    >;
    const other = discountCandidates(s, "business").find(
      (c) => c.id !== d.card,
    )!;
    expect(() =>
      reduceGame(s, { type: "BARGAIN_BUY", card: other.id }),
    ).toThrow();
    expect(canBargainBuy(s, s.players[1], "business")).toBe(false);
    expect(
      discountCandidates(s, "business").every(
        (c) => !c.source && c.tier !== "fast",
      ),
    ).toBe(true);
    s.config.adaptedCards = true;
    expect(discountCandidates(s, "business").some((c) => c.source)).toBe(true);
    s = game();
    s.players[1].bankrupt = true;
    s.players[1].skip = 2;
    s.players[2].eliminated = true;
    s = openOffer(shock(shock(s, "business"), "business"));
    expect(s.decision).toMatchObject({ responder: 0, remaining: [3, 4] });
    validateSave(s);
  });
  it("resumes the random draw and an already selected offer without changing the asset", () => {
    let s = shock(shock(game(), "property"), "property");
    while (s.decision?.kind === "market" && s.decision.remaining.length)
      s = reduceGame(s, { type: "PASS" });
    const restored = validateSave(JSON.parse(JSON.stringify(s)));
    expect(reduceGame(restored, { type: "PASS" })).toEqual(
      reduceGame(s, { type: "PASS" }),
    );
    s = reduceGame(s, { type: "PASS" });
    expect(reduceGame(validateSave(s), { type: "PASS" })).toEqual(
      reduceGame(s, { type: "PASS" }),
    );
    const bad = structuredClone(s);
    (bad.decision as { remaining: number[] }).remaining = [0];
    expect(() => validateSave(bad)).toThrow();
  });
  it("preserves manual purchases and queue position until correct accounting commits once", () => {
    let s = discounted("property");
    s.config.accounting = "manual";
    s.players[0].cash = 10000000000;
    const card = (s.decision as { card: string }).card;
    s = reduceGame(s, { type: "BARGAIN_BUY", card, outright: true });
    expect(s.pending!.completeDiscount).toBe(true);
    expect(s.decision).toMatchObject({ responder: 0 });
    expect(s.players[0].assets).toHaveLength(0);
    s = validateSave(JSON.parse(JSON.stringify(s)));
    s = reduceGame(s, { type: "SUBMIT", values: { cash: "0" } });
    expect(s.pending!.errors.length).toBeGreaterThan(0);
    expect(s.decision).toMatchObject({ responder: 0 });
    const values = Object.fromEntries(
      s.pending!.fields.map((k) => [
        k,
        String(s.pending!.receipt.after[k] / 100),
      ]),
    );
    s = reduceGame(s, { type: "SUBMIT", values });
    expect(s.pending).toBeNull();
    expect(s.decision).toMatchObject({ kind: "discount", card, responder: 1 });
    expect(s.players[0].assets).toHaveLength(1);
    expect(s.players[0].assets[0].mortgage).toBe(0);
    expect(() => reduceGame(s, { type: "SUBMIT", values })).toThrow();
    expect(
      s.receipts.filter((r) => r.title.startsWith("Discount purchase:")),
    ).toHaveLength(1);
    validateSave(s);
  });
  it("NPCs evaluate only the offered asset and never borrow outside their own turn", () => {
    let s = discounted("business");
    s.current = 1;
    s.players[0].profile = "bold";
    s.players[0].cash = 0;
    (s.decision as { card: string }).card = business.id;
    const result = chooseNpc(npcView(s));
    expect(result.action.type).toBe("PASS");
    expect(() => reduceGame(s, result.action)).not.toThrow();
    s = discounted("property");
    s.current = 0;
    s.players[1].profile = "cautious";
    s.players[1].cash = 10000000000;
    (s.decision as { card: string }).card = property.id;
    s = reduceGame(s, { type: "PASS" });
    expect(chooseNpc(npcView(s)).action.type).toBe("PASS");
    const v = npcView(s);
    expect(v).not.toHaveProperty("rng");
    expect(v).not.toHaveProperty("decks");
  });
});

describe("market depressions", () => {
  it("enters strictly below 35%, chooses a 5–10 round interval and caps positive shocks", () => {
    let s = shock(shock(game(), "stock", "down", 30), "stock");
    expect(s.marketState!.indices.stock).toBe(3500);
    expect(activeDepression(s, "stock")).toBeNull();
    s = shock(s, "stock", "down", 15);
    const d = activeDepression(s, "stock")!;
    expect(d.expires - d.start).toBeGreaterThanOrEqual(5);
    expect(d.expires - d.start).toBeLessThanOrEqual(10);
    expect(d.start).toBe(s.round);
    s = shock(s, "stock", "up");
    expect(s.marketState!.indices.stock).toBe(3499);
    expect(activeDepression(s, "stock")).toEqual(d);
    expect(s.marketState!.history.at(-1)?.depression).toEqual(d);
    expect(activeDepression(s, "business")).toBeNull();
    validateSave(s);
  });
  it("continues seeded fluctuations through expiry without resetting prices or relocking", () => {
    let s = shock(shock(game(), "stock"), "stock");
    const d = activeDepression(s, "stock")!;
    s.marketState!.dynamics!.deck = ["trend-stock-boom"];
    const prices = new Set<number>();
    while (s.round < d.expires) {
      s = nextRound(s);
      prices.add(s.marketState!.indices.stock);
      const tick = s.marketState!.history.at(-3)!;
      if (s.round < d.expires) {
        expect(s.marketState!.indices.stock).toBeLessThan(3500);
        expect(
          s.marketState!.history.filter((t) => t.category === "stock").at(-1)!
            .source,
        ).toBe("drift");
      }
      expect(tick.round).toBe(s.round);
      validateSave(s);
    }
    expect(prices.size).toBeGreaterThan(1);
    expect(activeDepression(s, "stock")).toBeNull();
    expect(s.marketState!.indices.stock).not.toBe(10000);
    expect(s.marketState!.dynamics!.depressions!.stock).toEqual(d);
    s.config.economicCycles = false;
    // Clear any still-active cycle before testing an expired sub-35 market.
    s.marketState!.dynamics!.active = null;
    s = nextRound(s);
    if (s.marketState!.indices.stock < 3500)
      expect(activeDepression(s, "stock")).toBeNull();
    while (s.marketState!.indices.stock < 3500) s = shock(s, "stock", "up");
    s = shock(s, "stock");
    expect(activeDepression(s, "stock")!.start).toBe(s.round);
    validateSave(s);
  });
  it("resumes depression duration, next movement and purchases deterministically", () => {
    let s = discounted("business");
    s.players[0].cash = 10000000000;
    const saved = validateSave(JSON.parse(JSON.stringify(s)));
    expect(nextRound(saved)).toEqual(nextRound(s));
    expect(
      reduceGame(saved, {
        type: "BARGAIN_BUY",
        card: (s.decision as { card: string }).card,
      }),
    ).toEqual(
      reduceGame(s, {
        type: "BARGAIN_BUY",
        card: (s.decision as { card: string }).card,
      }),
    );
    for (const corrupt of [
      (bad: GameState) => {
        bad.marketState!.dynamics!.depressions!.business!.expires = 100;
      },
      (bad: GameState) => {
        bad.marketState!.history.at(-1)!.depression!.expires = 100;
      },
      (bad: GameState) => {
        bad.players[0].bargainBuys = { business: bad.round + 1 };
      },
    ]) {
      const bad = structuredClone(s);
      corrupt(bad);
      expect(() => validateSave(bad)).toThrow();
    }
  });
});
