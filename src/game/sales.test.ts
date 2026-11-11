import { describe, expect, it } from "vitest";
import { smallDeals } from "./content";
import { assetIncome, requiredReserve } from "./economy";
import {
  assetFromDeal,
  createGame,
  marketSaleQuote,
  playerFinancials,
  reduceGame,
} from "./engine";
import { chooseNpc, npcView } from "./npc";
import { voluntarySaleQuote } from "./sales";
import { validateSave } from "./storage";
import type { Asset, Deal, GameConfig, GameState } from "./types";

const stock = smallDeals.find((c) => c.category === "stock")!;
const business = smallDeals.find(
  (c) => c.category === "business" && !c.mortgage,
)!;
const property = smallDeals.find((c) => c.category === "property")!;
function game(config: Partial<GameConfig> = {}) {
  const s = createGame({
    profession: "designer",
    seed: 123,
    tutorials: false,
    liquidityRisk: false,
    economicCycles: false,
    ...config,
  });
  s.players[0].cash = 100000000;
  return s;
}
function own(s: GameState, card: Deal, id: string = card.category, player = 0) {
  const a = {
    ...assetFromDeal(card, id, card.category === "stock" ? 100 : 1),
    boughtRound: 1,
    acquisitionFee:
      card.category === "stock" ? 0 : Math.round(card.cost * 0.05),
  };
  s.players[player].assets.push(a);
  return a;
}
const sell = (s: GameState, a: Asset, player = 0) =>
  reduceGame(s, {
    type: "SELL_ANYTIME",
    playerId: s.players[player].id,
    assetId: a.id,
  });
const reload = (s: GameState) => validateSave(JSON.parse(JSON.stringify(s)));
function audit(s: GameState) {
  return reduceGame(s, {
    type: "SUBMIT",
    values: Object.fromEntries(
      s.pending!.fields.map((k) => [
        k,
        String(s.pending!.receipt.after[k] / 100),
      ]),
    ),
  });
}
function turn(s: GameState, round: number) {
  s.round = round;
  s.current = 0;
  s.phase = "roll";
  s.decision = null;
  s.effects = [];
  // Isolate scheduled closing from the subsequent round movement and landing.
  s.marketState!.dynamics!.lastRound = round;
  s.players[0].skip = 1;
  return reduceGame(s, { type: "ROLL" });
}

describe("anytime asset sales", () => {
  it("sells shares immediately outside the owner's turn, taxes gains, and preserves the active decision", () => {
    const s = game(),
      a = own(s, stock);
    s.marketState!.indices.stock = 15000;
    s.current = 1;
    s.phase = "decision";
    s.decision = {
      kind: "opportunity",
      owner: 1,
      card: business.id,
      transferred: false,
    };
    const before = playerFinancials(s, s.players[0]),
      quote = voluntarySaleQuote(s, a),
      next = sell(s, a);
    expect(quote.gross).toBe(Math.round(a.cost * 1.5));
    expect(quote.fee).toBe(0);
    expect(quote.tax).toBe(Math.round(a.cost * 0.5 * 0.2));
    expect(next.players[0].cash).toBe(before.cash + quote.net);
    expect(next.players[0].assets).toEqual([]);
    expect(next.players[0].stockGains).toBe(quote.taxableProfit);
    expect(next.players[1]).toEqual(s.players[1]);
    expect(next.current).toBe(1);
    expect(next.decision).toEqual(s.decision);
    expect(next.rng).toBe(s.rng);
    expect(next.receipts[0].after).toEqual(
      playerFinancials(next, next.players[0]),
    );
    expect(() => sell(next, a)).toThrow(/no longer own/);
  });

  it.each([
    [business, 500],
    [property, 1500],
  ] as const)(
    "lists $0.name without reducing cash or income, then settles the mortgage at closing",
    (card, discount) => {
      const s = game(),
        a = own(s, card),
        before = playerFinancials(s),
        listed = sell(s, a);
      const holding = listed.players[0].assets[0],
        listing = holding.listing!;
      expect(listing.closesRound - s.round).toBeGreaterThanOrEqual(1);
      expect(listing.closesRound - s.round).toBeLessThanOrEqual(3);
      expect(listing.discountBps).toBe(discount);
      expect(listing.gross).toBe(Math.round(a.cost * (1 - discount / 10000)));
      expect(playerFinancials(listed)).toEqual(before);
      expect(assetIncome(listed, holding)).toBe(assetIncome(s, a));
      const quote = voluntarySaleQuote(listed, holding);
      const closed = turn(listed, listing.closesRound);
      expect(closed.players[0].assets).toEqual([]);
      expect(closed.players[0].cash).toBe(before.cash + quote.net);
      expect(playerFinancials(closed).debt).toBe(before.debt - a.mortgage);
      expect(playerFinancials(closed).passive).toBe(0);
      expect(closed.receipts[0].after).toEqual(playerFinancials(closed));
      expect(closed.receipts[0].note).toContain(`discount: ${discount / 100}%`);
    },
  );

  it("does not close early, locks gross through market changes, and closes once", () => {
    const s = game(),
      a = own(s, business);
    let listed = sell(s, a);
    const listing = listed.players[0].assets[0].listing!,
      expected = voluntarySaleQuote(listed, listed.players[0].assets[0]);
    listed = turn(listed, listing.closesRound - 1);
    expect(listed.players[0].assets[0].listing).toEqual(listing);
    listed.marketState!.indices.business = 18000;
    let closed = turn(listed, listing.closesRound);
    expect(closed.receipts[0].note).toContain("Agreed quick-sale discount: 5%");
    expect(closed.players[0].cash).toBe(s.players[0].cash + expected.net);
    closed = turn(closed, listing.closesRound + 1);
    expect(
      closed.receipts.filter((r) => r.title === `Sold ${a.name}`),
    ).toHaveLength(1);
  });

  it("uses the reduced mortgage and financing after a partial repayment", () => {
    const s = game(),
      a = own(s, property);
    let listed = sell(s, a);
    const oldQuote = voluntarySaleQuote(listed, listed.players[0].assets[0]),
      amount = Math.floor(a.mortgage / 2);
    listed = reduceGame(listed, { type: "REPAY", debtId: a.id, amount });
    const holding = listed.players[0].assets[0],
      quote = voluntarySaleQuote(listed, holding);
    expect(quote.mortgage).toBe(a.mortgage - amount);
    expect(quote.penalty).toBe(holding.financing * 2);
    expect(quote.net).toBeGreaterThan(oldQuote.net + amount);
    const closed = turn(listed, holding.listing!.closesRound);
    expect(closed.players[0].cash).toBe(listed.players[0].cash + quote.net);
  });

  it("can cancel a listing and never settle a cancelled sale", () => {
    const s = game(),
      a = own(s, property),
      listed = sell(s, a),
      due = listed.players[0].assets[0].listing!.closesRound;
    const cancelled = reduceGame(listed, {
      type: "CANCEL_SALE",
      playerId: "p0",
      assetId: a.id,
    });
    expect(cancelled.players[0].assets[0].listing).toBeUndefined();
    expect(playerFinancials(cancelled)).toEqual(playerFinancials(listed));
    expect(turn(cancelled, due).players[0].assets).toHaveLength(1);
    expect(() =>
      reduceGame(cancelled, {
        type: "CANCEL_SALE",
        playerId: "p0",
        assetId: a.id,
      }),
    ).toThrow(/not listed/);
  });

  it("sells a listed asset immediately at a matching market with no quick-sale discount or duplicate closing", () => {
    const s = game(),
      a = own(s, property);
    let listed = sell(s, a);
    const due = listed.players[0].assets[0].listing!.closesRound;
    listed.phase = "decision";
    listed.decision = {
      kind: "market",
      card: "shock-property-up-15",
      responder: 0,
      remaining: [],
    };
    const quote = marketSaleQuote(listed, listed.players[0].assets[0]),
      quick = voluntarySaleQuote(listed, listed.players[0].assets[0]);
    expect(quote.gross).toBe(a.cost);
    expect(quote.gross).toBeGreaterThan(quick.gross);
    listed = reduceGame(listed, { type: "SELL", assetId: a.id });
    expect(listed.players[0].cash).toBe(s.players[0].cash + quote.net);
    expect(listed.players[0].assets).toEqual([]);
    listed = reduceGame(listed, { type: "PASS" });
    expect(
      turn(listed, due).receipts.filter((r) => r.title === `Sold ${a.name}`),
    ).toHaveLength(1);
  });

  it("cancels an underwater sale at closing if the seller can no longer cover its shortfall", () => {
    const s = game(),
      a = own(s, property);
    s.marketState!.indices.property = 5000;
    const listed = sell(s, a),
      holding = listed.players[0].assets[0];
    expect(voluntarySaleQuote(listed, holding).net).toBeLessThan(0);
    listed.players[0].cash = 0;
    const closed = turn(listed, holding.listing!.closesRound);
    expect(closed.players[0].cash).toBe(0);
    expect(closed.players[0].assets[0].listing).toBeUndefined();
    expect(closed.players[0].assets[0].mortgage).toBe(a.mortgage);
    expect(closed.receipts[0].title).toContain("Sale cancelled");
  });

  it("does not settle a listing removed by forced liquidation", () => {
    const s = game({ liquidityRisk: true }),
      a = own(s, property),
      listed = sell(s, a);
    const due = listed.players[0].assets[0].listing!.closesRound;
    listed.players[0].cash = 0;
    listed.phase = "decision";
    listed.decision = { kind: "liquidity", resume: "roll" };
    const liquidated = reduceGame(listed, { type: "LIQUIDATE", assetId: a.id }),
      cash = liquidated.players[0].cash;
    expect(liquidated.players[0].assets).toEqual([]);
    expect(turn(liquidated, due).players[0].cash).toBe(cash);
  });

  it("audits stock sales out of turn, persists incorrect entries, and commits once", () => {
    const s = game({ accounting: "manual" }),
      a = own(s, stock);
    s.current = 1;
    const pending = sell(s, a);
    expect(pending.players[0].assets).toHaveLength(1);
    expect(pending.pending?.next.assets).toEqual([]);
    expect(() => sell(pending, a)).toThrow(/worksheet/);
    const wrong = reduceGame(pending, {
      type: "SUBMIT",
      values: { cash: "0" },
    });
    expect(wrong.pending?.errors.length).toBeGreaterThan(0);
    const committed = audit(reload(wrong));
    expect(committed.pending).toBeNull();
    expect(committed.players[0].assets).toEqual([]);
    expect(committed.current).toBe(1);
    expect(committed.players[0].cash).toBe(pending.pending!.next.cash);
    expect(() => reduceGame(committed, { type: "SUBMIT", values: {} })).toThrow(
      /no accounting/,
    );
    expect(
      committed.receipts.filter((r) => r.title === `Sold ${a.name}`),
    ).toHaveLength(1);
  });

  it("pauses each scheduled manual closing and resumes without a second sale or reroll", () => {
    const s = game({ accounting: "manual" }),
      a = own(s, business, "first"),
      b = own(s, property, "second");
    let listed = sell(sell(s, a), b);
    const due = Math.max(
      ...listed.players[0].assets.map((v) => v.listing!.closesRound),
    );
    listed = turn(listed, due);
    expect(listed.phase).toBe("roll");
    expect(listed.pending).toBeTruthy();
    expect(listed.dice).toEqual([]);
    let completed = audit(reload(listed));
    expect(completed.players[0].assets).toHaveLength(1);
    completed = reduceGame(completed, { type: "ROLL" });
    expect(completed.pending).toBeTruthy();
    completed = audit(reload(completed));
    expect(completed.players[0].assets).toEqual([]);
    completed = reduceGame(completed, { type: "ROLL" });
    expect(completed.phase).toBe("end");
    expect(
      completed.receipts.filter((r) => r.title.startsWith("Sold ")),
    ).toHaveLength(2);
    expect(completed.receipts[0].after).toEqual(playerFinancials(completed));
  });

  it("preserves seeded listing times and the next actual roll on resume", () => {
    const s = game(),
      a = own(s, property),
      listed = sell(s, a);
    expect(sell(reload(s), a)).toEqual(listed);
    expect(reduceGame(reload(listed), { type: "ROLL" })).toEqual(
      reduceGame(listed, { type: "ROLL" }),
    );
    const waits = new Set<number>();
    for (const rng of [1, 123, 100000, 1000000, 123456789, 4000000000]) {
      const copy = structuredClone(s);
      copy.rng = rng;
      waits.add(sell(copy, a).players[0].assets[0].listing!.closesRound - 1);
    }
    expect([...waits].sort()).toEqual([1, 2, 3]);
  });

  it("rejects damaged listings and sales after elimination or match end", () => {
    const s = game(),
      a = own(s, property),
      listed = sell(s, a);
    for (const patch of [
      { closesRound: 99 },
      { discountBps: 500 },
      { gross: -1 },
      { listedRound: 99 },
    ]) {
      const copy = structuredClone(listed);
      Object.assign(copy.players[0].assets[0].listing!, patch);
      expect(() => reload(copy)).toThrow();
    }
    s.players[0].eliminated = true;
    expect(() => sell(s, a)).toThrow(/active/);
    s.players[0].eliminated = false;
    s.phase = "finished";
    expect(() => sell(s, a)).toThrow(/finished/);
    s.phase = "roll";
    expect(() => sell(s, a, 1)).toThrow(/own holdings/);
  });

  it("allows NPCs to restore liquidity with stocks and stops selling once a bill is covered", () => {
    const s = game({ liquidityRisk: true }),
      a = own(s, stock, "emergency", 1);
    s.current = 1;
    s.players[1].cash = requiredReserve(s.players[1]) - 1000;
    s.phase = "decision";
    s.decision = { kind: "liquidity", resume: "roll" };
    const choice = chooseNpc(npcView(s));
    expect(choice.action).toMatchObject({
      type: "SELL_ANYTIME",
      assetId: a.id,
    });
    const next = reduceGame(s, choice.action);
    expect(next.decision).toBeNull();
    expect(next.phase).toBe("roll");
    own(next, stock, "remaining", 1);
    next.phase = "decision";
    next.decision = { kind: "insolvency", amount: 100, title: "Covered bill" };
    expect(chooseNpc(npcView(next)).action.type).toBe("PASS");
  });
});
