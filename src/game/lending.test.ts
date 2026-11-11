import { describe, expect, it } from "vitest";
import {
  createGame,
  reduceGame,
  assetFromDeal,
  playerFinancials,
} from "./engine";
import { smallDeals } from "./content";
import { effectiveDeal, debtPayment, assetIncome } from "./economy";
import { purchaseQuote, type1PurchaseCount, initialMarkets } from "./market";
import { borrowingQuote, lendingSnapshot, purchaseLending } from "./lending";
import { validateSave } from "./storage";
import { chooseNpc, npcView } from "./npc";
import type { GameState } from "./types";

const property = smallDeals.find(
  (c) => c.category === "property" && c.mortgage > 0,
)!;
const business = smallDeals.find(
  (c) => c.category === "business" && !c.mortgage,
)!;
const stock = smallDeals.find((c) => c.category === "stock")!;
function game() {
  const s = createGame({
    profession: "designer",
    seed: 123,
    liquidityRisk: false,
    tutorials: false,
  });
  s.players[0].cash = 100000000;
  return s;
}
function offer(s: GameState, card = property) {
  s.phase = "decision";
  s.effects = [];
  s.decision = {
    kind: "opportunity",
    owner: s.current,
    transferred: false,
    card: card.id,
  };
  return s;
}
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
describe("rising down payments and separate purchase lending", () => {
  it("uses all five tiers, recalculates net income, and retains the tier after payoff, sale and reload", () => {
    let s = game();
    for (const [i, rate] of [0.1, 0.15, 0.2, 0.25, 0.35, 0.35].entries()) {
      offer(s);
      const q = purchaseQuote(s, effectiveDeal(s, property));
      expect(q.tier).toBe(i + 1);
      expect(q.down).toBe(Math.round(property.cost * rate));
      expect(q.mortgage).toBe(property.cost - q.down);
      expect(q.deal.financing).toBe(
        Math.round((property.financing * q.mortgage) / property.mortgage),
      );
      expect(q.deal.income + q.deal.financing).toBe(
        property.income + property.financing,
      );
      const before = playerFinancials(s),
        bought = reduceGame(s, { type: "BUY" });
      const a = bought.players[0].assets.at(-1)!;
      expect(a.down + a.mortgage).toBe(a.cost);
      expect(playerFinancials(bought).passive - before.passive).toBe(
        assetIncome(bought, a),
      );
      expect(playerFinancials(bought).expenses).toBe(before.expenses);
      expect(bought.players[0].type1Purchases).toBe(i + 1);
      s = validateSave(JSON.parse(JSON.stringify(bought)));
    }
    const a = s.players[0].assets[0];
    s = reduceGame(s, { type: "REPAY", debtId: a.id, amount: a.mortgage });
    s.decision = {
      kind: "market",
      card: "pulse-property-6",
      responder: 0,
      remaining: [],
    };
    s.phase = "decision";
    s = reduceGame(s, { type: "SELL", assetId: a.id });
    expect(s.players[0].type1Purchases).toBe(6);
    expect(purchaseQuote(s, property).tier).toBe(7);
    s = reduceGame(offer(s), { type: "BUY", outright: true });
    expect(s.players[0].type1Purchases).toBe(6);
  });
  it("uses the current market price for down payments and keeps original holdings unchanged", () => {
    const s = game();
    const existing = assetFromDeal(property, "old");
    s.players[0].assets = [existing];
    s.marketState!.indices.property = 5000;
    const q = purchaseQuote(s, effectiveDeal(s, property));
    expect(q.price).toBe(property.cost / 2);
    expect(q.down).toBe(Math.round(q.price * 0.15));
    expect(existing.mortgage).toBe(property.mortgage);
    expect(existing.financing).toBe(property.financing);
  });
  it("infers old lifetime financed acquisitions from history after a holding is sold", () => {
    let s = reduceGame(offer(game()), { type: "BUY" });
    delete s.players[0].type1Purchases;
    s.players[0].assets = [];
    expect(type1PurchaseCount(s, s.players[0])).toBe(1);
    expect(purchaseQuote(s, property).downRate).toBe(0.15);
  });
  it("keeps 1% purchase and 2% ordinary loans separate, deducts costs once, and preserves purchase debt on sale", () => {
    let s = game();
    const before = playerFinancials(s),
      q = purchaseQuote(s, property);
    s = reduceGame(offer(s), { type: "BUY", loan: 1000000 });
    const purchase = s.players[0].debts.find((d) => d.kind === "purchase")!;
    expect(purchase.monthlyRateBps).toBe(100);
    expect(debtPayment(s, purchase)).toBe(10000);
    expect(s.players[0].cash).toBe(before.cash + 1000000 - q.cash);
    expect(playerFinancials(s).flow).toBe(before.flow + q.deal.income - 10000);
    s = reduceGame(s, { type: "BORROW", amount: 1000000 });
    const bank = s.players[0].debts.find((d) => d.kind === "bank")!;
    expect(bank.monthlyRateBps).toBe(200);
    expect(debtPayment(s, bank)).toBe(20000);
    s = reduceGame(s, { type: "REPAY", debtId: purchase.id, amount: 250000 });
    expect(
      debtPayment(
        s,
        s.players[0].debts.find((d) => d.kind === "purchase")!,
      ),
    ).toBe(7500);
    s.decision = {
      kind: "market",
      card: "pulse-property-6",
      responder: 0,
      remaining: [],
    };
    s.phase = "decision";
    s = reduceGame(s, { type: "SELL", assetId: s.players[0].assets[0].id });
    expect(s.players[0].assets).toHaveLength(0);
    expect(
      s.players[0].debts.find((d) => d.kind === "purchase")?.principal,
    ).toBe(750000);
    expect(s.players[0].debts.find((d) => d.kind === "bank")).toEqual(bank);
    expect(validateSave(s).players[0].debts).toEqual(s.players[0].debts);
  });
  it("commits a manually audited financed purchase exactly once across refresh and rejects incorrect entries", () => {
    const s = offer(game());
    s.config.accounting = "manual";
    const before = structuredClone(s.players[0]);
    const pending = reduceGame(s, { type: "BUY", loan: 1000000 });
    expect(pending.players[0]).toEqual(before);
    expect(pending.pending!.next.type1Purchases).toBe(1);
    const loaded = validateSave(JSON.parse(JSON.stringify(pending)));
    const wrong = reduceGame(loaded, { type: "SUBMIT", values: { cash: "0" } });
    expect(wrong.pending?.errors.length).toBeGreaterThan(0);
    expect(wrong.players[0]).toEqual(before);
    const done = audit(wrong);
    expect(done.players[0].assets).toHaveLength(1);
    expect(
      done.players[0].debts.filter((d) => d.kind === "purchase"),
    ).toHaveLength(1);
    expect(done.players[0].type1Purchases).toBe(1);
    expect(done.pending).toBeNull();
    expect(() => audit(done)).toThrow();
    expect(done.receipts[0].after).toEqual(playerFinancials(done));
  });
  it("forbids cheap unattached loans, invalid amounts, and recovery borrowing without mutating state", () => {
    for (const [card, extra] of [
      [business, {}],
      [stock, {}],
      [property, { outright: true }],
    ] as const) {
      const s = offer(game(), card),
        copy = structuredClone(s);
      expect(() =>
        reduceGame(s, { type: "BUY", loan: 100000, ...extra }),
      ).toThrow(/only with/);
      expect(s).toEqual(copy);
    }
    for (const amount of [-100000, 100001, NaN, Infinity, 100100000]) {
      const s = offer(game()),
        copy = structuredClone(s);
      expect(() => reduceGame(s, { type: "BUY", loan: amount })).toThrow(
        /increments/,
      );
      expect(s).toEqual(copy);
    }
    const s = offer(game());
    s.players[0].bankrupt = true;
    expect(() => reduceGame(s, { type: "BUY", loan: 100000 })).toThrow(
      /recovery/,
    );
    const passed = reduceGame(offer(game()), { type: "PASS" });
    expect(passed.players[0].debts.some((d) => d.kind === "purchase")).toBe(
      false,
    );
    expect(passed.players[0].type1Purchases).toBeUndefined();
  });
  it("preserves existing annual-rate loans and pending worksheets when new loans use the monthly rate", () => {
    let s = game();
    s.players[0].debts.push({
      id: "bank",
      kind: "bank",
      name: "Existing bank loan",
      principal: 1000000,
      payment: 0,
    });
    expect(debtPayment(s, s.players[0].debts.at(-1)!)).toBe(10000);
    s.config.accounting = "manual";
    s = reduceGame(s, { type: "BORROW", amount: 1000000 });
    s = audit(validateSave(JSON.parse(JSON.stringify(s))));
    const loans = s.players[0].debts.filter((d) => d.kind === "bank");
    expect(loans.map((d) => debtPayment(s, d))).toEqual([10000, 20000]);
  });
});

describe("55% new debt limit", () => {
  it("allows exact equality, rejects one more loan increment, and excludes every starting role debt", () => {
    let s = game();
    s.players[0].salary = 400000;
    s.players[0].debts[0].principal = 100000000;
    s.players[0].debts[0].payment = 200000;
    expect(borrowingQuote(s, s.players[0], 11000000).ratio).toBe(0.55);
    s = reduceGame(s, { type: "BORROW", amount: 11000000 });
    expect(lendingSnapshot(s, s.players[0]).service).toBe(220000);
    const copy = structuredClone(s);
    expect(() => reduceGame(s, { type: "BORROW", amount: 100000 })).toThrow(
      /55%/,
    );
    expect(s).toEqual(copy);
  });
  it("counts mortgages, both loan types and post-operating net asset income in the same projected test", () => {
    let s = game();
    s = reduceGame(offer(s), { type: "BUY", loan: 1000000 });
    s = reduceGame(s, { type: "BORROW", amount: 1000000 });
    offer(s);
    const q = purchaseQuote(s, property),
      projected = purchaseLending(s, s.players[0], q, 200000);
    expect(projected.service).toBe(
      s.players[0].assets[0].financing +
        q.deal.financing +
        10000 +
        20000 +
        2000,
    );
    expect(projected.income).toBe(
      s.players[0].salary + s.players[0].assets[0].income + q.deal.income,
    );
    expect(projected.netAfterLoan).toBe(
      property.income + property.financing - q.deal.financing - 2000,
    );
    s.players[0].salary = 1;
    const copy = structuredClone(s);
    expect(() => reduceGame(s, { type: "BUY", loan: 200000 })).toThrow(/55%/);
    expect(s).toEqual(copy);
    const outright = reduceGame(s, { type: "BUY", outright: true });
    expect(outright.players[0].assets.at(-1)!.mortgage).toBe(0);
  });
  it("rejects new borrowing with no qualifying income but allows debt-free purchases", () => {
    const s = game();
    s.players[0].salary = 0;
    expect(() => reduceGame(s, { type: "BORROW", amount: 100000 })).toThrow(
      /55%/,
    );
    expect(
      reduceGame(offer(s, business), { type: "BUY" }).players[0].assets,
    ).toHaveLength(1);
  });
  it("applies recipient tiers and lending limits to transfers and discounted responses outside their turn", () => {
    const s = offer(game());
    s.players[1].profile = "bold";
    s.players[1].cash = 100000000;
    s.players[1].type1Purchases = 3;
    const transferred = reduceGame(s, {
      type: "TRANSFER",
      target: 1,
      price: 0,
    });
    expect(transferred.players[1].assets[0].down).toBe(
      Math.round(property.cost * 0.25),
    );
    expect(transferred.players[1].type1Purchases).toBe(4);
    s.players[1].salary = 1;
    expect(() =>
      reduceGame(s, { type: "TRANSFER", target: 1, price: 0 }),
    ).toThrow(/55%/);
    const d = game();
    // A shared offer uses the responding player's own tier and finances.
    d.marketState!.indices.property = 4000;
    d.phase = "decision";
    d.decision = {
      kind: "discount",
      card: property.id,
      responder: 1,
      remaining: [],
      market: "pulse-property-0",
    };
    d.players[1].cash = 1000000;
    d.players[1].type1Purchases = 2;
    const bought = reduceGame(d, {
      type: "BARGAIN_BUY",
      card: property.id,
      loan: 100000,
    });
    expect(bought.players[1].type1Purchases).toBe(3);
    expect(bought.players[1].assets[0].down).toBe(
      Math.round(property.cost * 0.4 * 0.2),
    );
    expect(bought.players[1].debts.some((x) => x.kind === "purchase")).toBe(
      true,
    );
  });
  it("makes NPCs use purchase loans and decline illegal mortgages even with ample cash", () => {
    const s = offer(game());
    s.players[0].profile = "bold";
    s.players[0].cash = 0;
    const choice = chooseNpc(npcView(s));
    expect(choice.action).toMatchObject({ type: "BUY" });
    if (choice.action.type !== "BUY") throw new Error("Expected acquisition");
    expect(choice.action.loan).toBeGreaterThan(0);
    expect(choice.reason).toContain("1% monthly");
    const bought = reduceGame(s, choice.action);
    expect(
      lendingSnapshot(bought, bought.players[0]).service /
        playerFinancials(bought).income,
    ).toBeLessThanOrEqual(0.55);
    s.players[0].salary = 1;
    s.players[0].cash = 100000000;
    const rejected = chooseNpc(npcView(s));
    expect(rejected.action.type).toBe("PASS");
    expect(rejected.reason).toContain("55%");
    expect("rng" in npcView(s)).toBe(false);
    expect("decks" in npcView(s)).toBe(false);
  });
  it("rejects malformed rate/counter saves and retains the next seeded roll and card after loan purchase", () => {
    let s = reduceGame(offer(game()), { type: "BUY", loan: 100000 });
    let loaded = validateSave(JSON.parse(JSON.stringify(s)));
    for (let i = 0; i < 25; i++) {
      const action = chooseNpc(npcView(s)).action;
      s = reduceGame(s, action);
      loaded = reduceGame(loaded, action);
      expect(loaded).toEqual(s);
    }
    const bad = game();
    bad.players[0].type1Purchases = -1;
    expect(() => validateSave(bad)).toThrow();
    const rate = reduceGame(offer(game()), { type: "BUY", loan: 100000 });
    rate.players[0].debts.find((d) => d.kind === "purchase")!.monthlyRateBps =
      200;
    expect(() => validateSave(rate)).toThrow();
    expect(purchaseQuote({ marketState: initialMarkets() }, stock).down).toBe(
      stock.down,
    );
  });
});
