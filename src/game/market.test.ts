import { describe, expect, it } from "vitest";
import {
  createGame,
  reduceGame,
  assetFromDeal,
  playerFinancials,
  marketSalePrice,
} from "./engine";
import { deals, smallDeals, fastTrackBoard } from "./content";
import { assetIncome, assetValue, effectiveDeal } from "./economy";
import { modernMarkets, purchaseQuote, saleQuote } from "./market";
import { chooseNpc, npcView } from "./npc";
import { validateSave } from "./storage";
import type { AssetCategory, Deal, GameState } from "./types";
const property = smallDeals.find((c) => c.category === "property")!;
const business = smallDeals.find(
  (c) => c.category === "business" && !c.mortgage,
)!;
const stock = smallDeals.find((c) => c.category === "stock")!;
const game = () =>
  createGame({ profession: "designer", seed: 123, liquidityRisk: false });
function offer(s: GameState, card: Deal) {
  s.phase = "decision";
  s.decision = {
    kind: "opportunity",
    owner: s.current,
    transferred: false,
    card: card.id,
  };
  return s;
}
function pulse(s: GameState, category: AssetCategory, index = 0) {
  s.phase = "roll";
  s.decision = null;
  s.effects = [];
  s.players[s.current].position = 1;
  s.rng = 1;
  s.decks.market = [`pulse-${category}-${index}`];
  return reduceGame(s, { type: "ROLL" });
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
describe("persistent markets and trading costs", () => {
  it("defaults to four opponents, supports eight, and gives nine players equal starts and distinct dreams", () => {
    expect(createGame().players).toHaveLength(5);
    const s = createGame({ opponents: 8, profession: "lawyer" });
    expect(s.players).toHaveLength(9);
    expect(new Set(s.players.map((p) => p.dream)).size).toBe(9);
    expect(new Set(s.players.map((p) => p.color)).size).toBe(9);
    expect(new Set(s.players.slice(1).map((p) => p.profile)).size).toBe(4);
    for (const p of s.players)
      expect(playerFinancials(s, p)).toEqual(playerFinancials(s, s.players[0]));
    expect(fastTrackBoard(s.players)).toHaveLength(32);
    expect(
      fastTrackBoard(s.players).filter((x) => x.kind === "dream"),
    ).toHaveLength(9);
    expect(validateSave(s).players).toEqual(s.players);
    expect(() => createGame({ opponents: 9 })).toThrow();
  });
  it.each([property, business])(
    "charges a 5% fee on the full price of $name",
    (card) => {
      const s = offer(game(), card);
      s.players[0].cash = 100000000;
      const q = purchaseQuote(s, card),
        bought = reduceGame(s, { type: "BUY" });
      expect(q.fee).toBe(Math.round(card.cost * 0.05));
      expect(bought.players[0].cash).toBe(s.players[0].cash - q.down - q.fee);
      expect(bought.players[0].assets[0]).toMatchObject({
        boughtRound: 1,
        acquisitionFee: q.fee,
        cost: card.cost,
      });
      expect(bought.receipts[0].note).toContain("Acquisition fee");
    },
  );
  it("can buy a financed opportunity outright without double-deducting financing", () => {
    const s = offer(game(), property);
    s.players[0].cash = 100000000;
    const bought = reduceGame(s, { type: "BUY", outright: true }),
      a = bought.players[0].assets[0];
    expect(a.mortgage).toBe(0);
    expect(a.financing).toBe(0);
    expect(assetIncome(bought, a)).toBe(property.income + property.financing);
    expect(bought.players[0].cash).toBe(
      s.players[0].cash - Math.round(property.cost * 1.05),
    );
  });
  it("settles fees, positive capital gains and the included mortgage separately", () => {
    const s = game(),
      a = {
        ...assetFromDeal(property, "example"),
        cost: 10000000,
        down: 2000000,
        mortgage: 8000000,
        financing: 60000,
        boughtRound: 1,
        acquisitionFee: 500000,
      };
    s.round = 10;
    expect(saleQuote(s, a, 13000000)).toEqual({
      gross: 13000000,
      fee: 1300000,
      penalty: 120000,
      taxableProfit: 1080000,
      tax: 216000,
      mortgage: 8000000,
      net: 3364000,
    });
    s.round = 11;
    expect(saleQuote(s, a, 13000000).penalty).toBe(0);
    expect(saleQuote(s, a, 8000000).tax).toBe(0);
  });
  it("exempts stocks from acquisition and sale fees while taxing positive gains", () => {
    const s = game(),
      a = {
        ...assetFromDeal(stock, "shares"),
        cost: 1000000,
        mortgage: 0,
        acquisitionFee: 0,
      };
    expect(purchaseQuote(s, stock, 100).fee).toBe(0);
    expect(saleQuote(s, a, 2000000)).toMatchObject({
      fee: 0,
      penalty: 0,
      tax: 200000,
      net: 1800000,
    });
    expect(saleQuote(s, a, 800000).tax).toBe(0);
  });
  it("reprices every owner's holdings and offers the same quote to all eligible players", () => {
    const s = game();
    for (const p of s.players)
      p.assets = [assetFromDeal(stock, `stock-${p.id}`, 10)];
    const before = s.players.map((p) => playerFinancials(s, p)),
      next = pulse(s, "stock");
    expect(next.marketState!.indices.stock).toBe(8500);
    expect(next.decision).toMatchObject({
      kind: "market",
      responder: 0,
      remaining: [1, 2, 3, 4],
    });
    for (const [i, p] of next.players.entries()) {
      expect(assetValue(next, p.assets[0])).toBe(
        Math.round(s.players[i].assets[0].cost * 0.85),
      );
      expect(assetIncome(next, p.assets[0])).toBe(
        Math.round(s.players[i].assets[0].income * 0.9625),
      );
      expect(p.cash).toBe(before[i].cash);
      expect(
        next.history.filter((h) => h.player === p.id).at(-1)?.values,
      ).toEqual(playerFinancials(next, p));
    }
    const quote = marketSalePrice(
      next.players[0].assets[0],
      modernMarkets[0],
      next,
    );
    expect(
      marketSalePrice(next.players[1].assets[0], modernMarkets[0], next),
    ).toBe(quote);
    let responded = next;
    for (let i = 0; i < 5; i++) {
      expect(responded.decision).toMatchObject({ responder: i });
      responded = reduceGame(responded, { type: "PASS" });
    }
    expect(responded.phase).toBe("end");
    expect(responded.marketState).toEqual(next.marketState);
  });
  it("changes real-estate values without changing rent or mortgage principal", () => {
    const s = game();
    s.players[0].assets = [assetFromDeal(property, "home")];
    const a = s.players[0].assets[0],
      next = pulse(s, "property");
    expect(assetValue(next, a)).toBe(Math.round(a.cost * 0.85));
    expect(assetIncome(next, a)).toBe(a.income);
    expect(next.players[0].assets[0].mortgage).toBe(a.mortgage);
  });
  it("keeps market changes through later rounds and prices new purchases exactly once", () => {
    let s = pulse(game(), "business");
    const index = s.marketState!.indices.business;
    s.round = 11;
    s.phase = "roll";
    s.players[0].position = 6;
    s.rng = 1;
    s = reduceGame(s, { type: "ROLL" });
    const driftIndex = s.marketState!.indices.business;
    expect(Math.abs(driftIndex / index - 1)).toBeLessThanOrEqual(0.01);
    expect(s.economy.active).toEqual([]);
    s = pulse(s, "business", 1);
    const factor = Math.round(driftIndex * 1.08) / 10000;
    expect(s.marketState!.indices.business).toBe(Math.round(driftIndex * 1.08));
    const c = effectiveDeal(s, business);
    expect(c.cost).toBe(Math.round(business.cost * factor));
    s.players[0].cash = 100000000;
    const bought = reduceGame(offer(s, business), { type: "BUY" }),
      a = bought.players[0].assets[0];
    expect(assetValue(bought, a)).toBe(c.cost);
    expect(assetIncome(bought, a)).toBe(
      Math.round(business.income * (1 + (factor - 1) * 0.25)),
    );
    expect(validateSave(bought).marketState).toEqual(bought.marketState);
  });
  it("preserves fee-bearing manual worksheets on refresh and commits once", () => {
    const s = offer(game(), business);
    s.config.accounting = "manual";
    s.players[0].cash = 10000000;
    const pending = reduceGame(s, { type: "BUY" }),
      q = purchaseQuote(s, business);
    expect(pending.players[0].assets).toEqual([]);
    expect(pending.pending!.receipt.after.cash).toBe(
      s.players[0].cash - q.cash,
    );
    const incorrect = reduceGame(pending, {
      type: "SUBMIT",
      values: { cash: "0" },
    });
    expect(incorrect.pending!.errors.length).toBeGreaterThan(0);
    const completed = audit(
      validateSave(JSON.parse(JSON.stringify(incorrect))),
    );
    expect(completed.players[0].cash).toBe(s.players[0].cash - q.cash);
    expect(completed.players[0].assets).toHaveLength(1);
    expect(() => audit(completed)).toThrow();
  });
  it("audits a market sale across refresh without collecting deductions twice", () => {
    let s = game();
    s.players[0].cash = 10000000;
    s = reduceGame(offer(s, property), { type: "BUY" });
    s = pulse(s, "property", 6);
    s.config.accounting = "manual";
    const a = s.players[0].assets[0],
      before = s.players[0].cash;
    const pending = reduceGame(s, { type: "SELL", assetId: a.id });
    expect(pending.pending!.receipt.note).toContain("capital gains tax");
    expect(pending.players[0].assets).toHaveLength(1);
    const completed = audit(validateSave(JSON.parse(JSON.stringify(pending))));
    expect(completed.players[0].cash).toBe(pending.pending!.receipt.after.cash);
    expect(completed.players[0].cash).toBeGreaterThan(before);
    expect(completed.players[0].assets).toHaveLength(0);
    expect(
      completed.receipts.filter((r) => r.title === `Sold ${a.name}`),
    ).toHaveLength(1);
    expect(() =>
      reduceGame(completed, { type: "SELL", assetId: a.id }),
    ).toThrow();
  });
  it("rejects a sale cost shortfall atomically", () => {
    let s = game();
    s.players[0].cash = 0;
    s.players[0].assets = [
      {
        ...assetFromDeal(property, "underwater"),
        cost: 10000000,
        referenceValue: 10000000,
        down: 1000000,
        mortgage: 9000000,
        financing: 50000,
        boughtRound: 1,
      },
    ];
    s = pulse(s, "property");
    const before = structuredClone(s);
    expect(() =>
      reduceGame(s, { type: "SELL", assetId: "underwater" }),
    ).toThrow(/sale costs/);
    expect(s).toEqual(before);
  });
  it("charges acquisition fees on accepted transfers and respects conservative refusals", () => {
    const c = smallDeals.find(
      (d) => d.transferable && d.category === "property",
    )!;
    const s = offer(game(), c);
    s.players[1].cash = 100000000;
    s.players[1].profile = "cautious";
    expect(() =>
      reduceGame(s, { type: "TRANSFER", target: 1, price: 100000 }),
    ).toThrow(/personality/);
    s.players[1].profile = "bold";
    const q = purchaseQuote(s, c),
      transferred = reduceGame(s, {
        type: "TRANSFER",
        target: 1,
        price: 100000,
      });
    expect(transferred.players[1].cash).toBe(
      s.players[1].cash - q.cash - 100000,
    );
    expect(transferred.players[0].cash).toBe(s.players[0].cash + 100000);
    expect(transferred.players[1].assets[0]).toMatchObject({
      acquisitionFee: q.fee,
      boughtRound: 1,
    });
    s.players[1].profile = "income";
    expect(() =>
      reduceGame(s, { type: "TRANSFER", target: 1, price: 100000 }),
    ).toThrow(/personality/);
    s.players[1].stockGains = 2000000;
    const speculator = reduceGame(s, {
      type: "TRANSFER",
      target: 1,
      price: 100000,
    });
    expect(speculator.players[1].assets[0]).toMatchObject({
      mortgage: 0,
      financing: 0,
      acquisitionFee: q.fee,
    });
    expect(speculator.players[1].cash).toBe(
      s.players[1].cash - purchaseQuote(s, c, 1, true).cash - 100000,
    );
  });
  it("bases early sale penalties on financing after partial principal repayment", () => {
    let s = game();
    s.players[0].cash = 100000000;
    s = reduceGame(offer(s, property), { type: "BUY" });
    const a = s.players[0].assets[0];
    s = reduceGame(s, {
      type: "REPAY",
      debtId: a.id,
      amount: Math.floor(a.mortgage / 2),
    });
    const paid = s.players[0].assets[0];
    expect(paid.financing).toBeLessThan(a.financing);
    expect(saleQuote(s, paid, property.cost).penalty).toBe(paid.financing * 2);
    expect(paid.cost).toBe(a.cost);
    expect(paid.acquisitionFee).toBe(a.acquisitionFee);
  });
  it("does not discard separate personal purchase loans when an asset is sold", () => {
    let s = game();
    s.players[0].cash = 10000000;
    s = reduceGame(s, { type: "BORROW", amount: 1000000 });
    s = reduceGame(offer(s, business), { type: "BUY" });
    s = pulse(s, "business", 6);
    const bank = s.players[0].debts.find((d) => d.kind === "bank")!,
      asset = s.players[0].assets[0];
    const sold = reduceGame(s, { type: "SELL", assetId: asset.id });
    expect(sold.players[0].debts.find((d) => d.id === bank.id)).toEqual(bank);
    expect(sold.receipts[0].note).toContain("capital gains tax");
  });
  it("rejects corrupted market history and resumes the same roll and deck", () => {
    const s = pulse(game(), "stock"),
      loaded = validateSave(JSON.parse(JSON.stringify(s)));
    expect(reduceGame(s, { type: "END" })).toEqual(
      reduceGame(loaded, { type: "END" }),
    );
    let original = s,
      resumed = loaded,
      rolls = 0,
      cards = 0;
    for (let i = 0; i < 30; i++) {
      const action = chooseNpc(npcView(original)).action;
      if (action.type === "ROLL") rolls++;
      if (action.type === "DRAW") cards++;
      original = reduceGame(original, action);
      resumed = reduceGame(resumed, action);
      expect(resumed).toEqual(original);
    }
    expect(rolls).toBeGreaterThan(0);
    expect(cards).toBeGreaterThan(0);
    const bad = structuredClone(s);
    bad.marketState!.indices.stock++;
    expect(() => validateSave(bad)).toThrow();
    const broken = structuredClone(s);
    broken.marketState!.history[0].after = NaN;
    expect(() => validateSave(broken)).toThrow();
    const wrongMultiplier = structuredClone(s);
    wrongMultiplier.marketState!.history[0].after++;
    wrongMultiplier.marketState!.indices.stock++;
    expect(() => validateSave(wrongMultiplier)).toThrow();
    const wrongDeck = structuredClone(s);
    wrongDeck.decks.market = ["market-0"];
    expect(() => validateSave(wrongDeck)).toThrow();
  });
  it("rejects a pending purchase timestamp in the future", () => {
    const s = offer(game(), business);
    s.players[0].cash = 10000000;
    s.config.accounting = "manual";
    const pending = reduceGame(s, { type: "BUY" });
    pending.pending!.next.assets[0].boughtRound = 2;
    expect(() => validateSave(pending)).toThrow();
  });
});

describe("distinct NPC personalities", () => {
  function view(
    card: Deal,
    profile: GameState["players"][number]["profile"],
    cash = 100000000,
  ) {
    const s = offer(game(), card);
    s.players[0].profile = profile;
    s.players[0].cash = cash;
    s.config.difficulty = "hard";
    return npcView(s);
  }
  it("never lets a conservative saver buy a Type 1 deal or borrow for Type 2", () => {
    expect(chooseNpc(view(property, "cautious")).action.type).toBe("PASS");
    expect(chooseNpc(view(business, "cautious", 0)).action.type).toBe("PASS");
    expect(chooseNpc(view(business, "cautious")).action.type).toBe("BUY");
  });
  it("lets aggressive investors finance a debt-free business even when interest eats its income", () => {
    const v = view(business, "bold", 0);
    v.config.annualRate = 24;
    const result = chooseNpc(v);
    expect(result.action.type).toBe("BORROW");
    expect(result.reason).toContain("consumes all the deal income");
  });
  it("buys zero-dividend stocks for capital gains and avoids early non-stock deals", () => {
    const zero = deals.find((c) => c.category === "stock" && c.income === 0)!;
    const picked = chooseNpc(view(zero, "income"));
    expect(picked.action.type).toBe("BUY");
    if (picked.action.type === "BUY")
      expect(picked.action.shares).toBeGreaterThan(10);
    expect(chooseNpc(view(business, "income")).action.type).toBe("PASS");
    const rich = view(business, "income");
    rich.player.stockGains = 2000000;
    expect(chooseNpc(rich).action).toMatchObject({
      type: "BUY",
      outright: true,
    });
    const rental = view(property, "income");
    rental.player.stockGains = 2000000;
    expect(chooseNpc(rental).action).toMatchObject({
      type: "BUY",
      outright: true,
    });
  });
  it("lets a balanced investor sell profitable stocks and then reduce investment financing", () => {
    const s = game();
    s.players[0].profile = "diverse";
    s.players[0].cash = 10000000;
    s.players[0].assets = [
      assetFromDeal(stock, "shares", 100),
      assetFromDeal(property, "rental"),
    ];
    const next = pulse(s, "stock", 6),
      sale = chooseNpc(npcView(next));
    expect(sale.action).toEqual({ type: "SELL", assetId: "shares" });
    let sold = reduceGame(next, sale.action);
    sold = reduceGame(sold, { type: "PASS" });
    expect(chooseNpc(npcView(sold)).action).toMatchObject({
      type: "REPAY",
      debtId: "rental",
    });
  });
  it("completes eight-NPC matches across common seeds and difficulties without illegal actions", () => {
    for (const difficulty of ["easy", "standard", "hard"] as const)
      for (const seed of [1, 47, 20261103]) {
        let s = createGame({
            opponents: 8,
            profession: "designer",
            roundLimit: 25,
            seed,
            difficulty,
            speed: "instant",
          }),
          steps = 0;
        while (s.phase !== "finished" && steps++ < 8000) {
          s = reduceGame(s, chooseNpc(npcView(s)).action);
          if (steps % 100 === 0) validateSave(s);
        }
        expect(s.phase, `${difficulty}/${seed}: ${steps} actions`).toBe(
          "finished",
        );
        validateSave(s);
        for (const p of s.players) {
          const f = playerFinancials(s, p);
          expect(Number.isSafeInteger(f.cash) && f.cash >= 0).toBe(true);
          expect(f.flow).toBe(f.income - f.expenses);
        }
      }
  }, 60000);
  it.each(["freedom", "full"] as const)(
    "finishes a natural %s victory with persistent markets",
    (victory) => {
      let s = createGame({
          seed: 20261103,
          victory,
          difficulty: "hard",
          opponents: 4,
        }),
        steps = 0;
      while (s.phase !== "finished" && steps++ < 12000)
        s = reduceGame(s, chooseNpc(npcView(s)).action);
      expect(s.phase, `${victory}: ${steps} actions, round ${s.round}`).toBe(
        "finished",
      );
      expect(s.winners.length).toBeGreaterThan(0);
      expect(s.finishReason).not.toContain("Round limit");
      validateSave(s);
      for (const p of s.players)
        expect(
          s.history.filter((h) => h.player === p.id).at(-1)?.values,
        ).toEqual(playerFinancials(s, p));
    },
    60000,
  );
});
