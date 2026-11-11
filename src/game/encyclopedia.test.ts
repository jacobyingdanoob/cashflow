import { createLegacyGame as createGame } from "../../tests/legacyGame";
import { describe, expect, it } from "vitest";
import { professions } from "./content";
import {
  encyclopediaSmallDeals,
  encyclopediaLargeDeals,
  encyclopediaMarkets,
  encyclopediaExpenses,
} from "./encyclopedia";
import {
  assetFromDeal,
  marketSalePrice,
  playerFinancials,
  reduceGame,
} from "./engine";
import { npcView, chooseNpc } from "./npc";
import { validateSave } from "./storage";
import type { GameState } from "./types";
const game = () =>
  createGame({
    profession: "designer",
    adaptedCards: true,
    liquidityRisk: false,
    economicCycles: false,
  });
describe("opening balance and optional principal", () => {
  it("keeps the original role balances available for existing saves", () => {
    for (const profession of [
      "designer",
      "nurse",
      "engineer",
      "teacher",
      "electrician",
      "doctor",
    ]) {
      const s = createGame({ profession });
      expect(playerFinancials(s).debt).toBeGreaterThanOrEqual(12800000);
      expect(playerFinancials(s).debt).toBeLessThanOrEqual(13000000);
    }
    expect(professions).toHaveLength(15);
  });
  it("defaults autopay off and ends a turn without requiring principal", () => {
    const s = game();
    s.phase = "end";
    s.players[0].cash = 1;
    const debt = playerFinancials(s).debt;
    expect(s.config.principalRate).toBe(0);
    const next = reduceGame(s, { type: "END" });
    expect(next.current).toBe(1);
    expect(next.players[0].cash).toBe(1);
    expect(playerFinancials(next, next.players[0]).debt).toBe(debt);
    expect(
      next.history.some((h) => h.title === "Scheduled principal payment"),
    ).toBe(false);
  });
  it("keeps saved debt, payments, and an explicitly chosen autopay setting", () => {
    const s = game();
    s.config.principalRate = 1;
    s.players[0].debts[0].principal = 16500000;
    s.players[0].debts[0].payment = 105000;
    const loaded = validateSave(s);
    expect(loaded.players).toEqual(s.players);
    expect(loaded.config.principalRate).toBe(1);
  });
});
describe("economic opening grace period", () => {
  it("draws no cycle through round 10, then draws on 11 and 14", () => {
    let s = createGame({ liquidityRisk: false, economicCycles: true });
    s.economy.deck = ["rate-cut", "rate-hike"];
    const roll = (round: number) => {
      s.round = round;
      s.phase = "roll";
      s.decision = null;
      s.effects = [];
      s = reduceGame(s, { type: "ROLL" });
    };
    for (let r = 1; r <= 10; r++) {
      roll(r);
      expect(s.economy.active).toHaveLength(0);
      expect(s.economy.deck).toEqual(["rate-cut", "rate-hike"]);
    }
    roll(11);
    expect(s.economy.active).toEqual([
      { card: "rate-hike", start: 11, expires: 14 },
    ]);
    roll(12);
    roll(13);
    expect(s.economy.deck).toEqual(["rate-cut"]);
    roll(14);
    expect(s.economy.active).toEqual([
      { card: "rate-cut", start: 14, expires: 17 },
    ]);
    expect(s.notices.filter((n) => n.kind === "cycle")).toHaveLength(2);
  });
});
describe("adapted encyclopedia cards", () => {
  it("includes the complete sourced packs with balanced financing declarations", () => {
    expect([
      encyclopediaSmallDeals.length,
      encyclopediaLargeDeals.length,
      encyclopediaMarkets.length,
      encyclopediaExpenses.length,
    ]).toEqual([20, 15, 12, 15]);
    for (const c of [...encyclopediaSmallDeals, ...encyclopediaLargeDeals]) {
      expect(c.cost).toBe(c.down + c.mortgage);
      expect(c.source?.url).toMatch(
        /^https:\/\/cashflow.lifestyle\/encyclopedia\//,
      );
    }
    expect(
      encyclopediaSmallDeals
        .filter((c) => c.category === "stock")
        .every((c) => c.income === 0),
    ).toBe(true);
  });
  it("converts operating income to net income and supports partial business financing repayment", () => {
    let s = game();
    const c = encyclopediaLargeDeals.find(
      (c) => c.name === "Franchise Restaurant",
    )!;
    s.players[0].cash = 10000000;
    s.phase = "decision";
    s.decision = {
      kind: "opportunity",
      owner: 0,
      transferred: false,
      card: c.id,
    };
    const before = playerFinancials(s);
    s = reduceGame(s, { type: "BUY" });
    expect(playerFinancials(s).cash).toBe(before.cash - 2500000);
    expect(playerFinancials(s).debt).toBe(before.debt + 7500000);
    expect(playerFinancials(s).passive).toBe(35000);
    expect(playerFinancials(s).expenses).toBe(before.expenses);
    s = reduceGame(s, {
      type: "REPAY",
      debtId: s.players[0].assets[0].id,
      amount: 750000,
    });
    expect(playerFinancials(s).passive).toBe(39500);
    expect(validateSave(s).players).toEqual(s.players);
  });
  const stockSale = () => {
    const s = game();
    s.players[0].assets = [
      assetFromDeal(encyclopediaSmallDeals[0], "tech", 10),
    ];
    s.phase = "decision";
    s.decision = {
      kind: "market",
      card: "enc-m2",
      responder: 0,
      remaining: [],
    };
    return s;
  };
  it("prices stock offers per share rather than as a cost multiplier", () => {
    const s = stockSale(),
      before = playerFinancials(s);
    expect(
      marketSalePrice(s.players[0].assets[0], encyclopediaMarkets[2], s),
    ).toBe(80000);
    const sold = reduceGame(s, { type: "SELL", assetId: "tech" });
    expect(playerFinancials(sold).cash).toBe(before.cash + 80000);
    expect(sold.players[0].assets).toHaveLength(0);
  });
  it("applies economic prices to share quotes once and gives NPCs the same quote", () => {
    const s = stockSale();
    s.economy.active = [{ card: "stock-selloff", start: 11, expires: 14 }];
    s.round = 11;
    const card = encyclopediaMarkets[2],
      asset = s.players[0].assets[0];
    expect(marketSalePrice(asset, card, s)).toBe(56000);
    const v = npcView(s);
    expect(marketSalePrice(v.eligibleAssets[0], v.market!)).toBe(56000);
    expect(chooseNpc(v).action).toMatchObject({ type: "SELL" });
    expect(chooseNpc(v).reason).toContain("$560");
  });
  it("settles a mortgage from a property buyer’s offer", () => {
    const s = game(),
      c = encyclopediaSmallDeals.find((c) => c.name === "Studio Apartment")!;
    s.players[0].assets = [assetFromDeal(c, "studio")];
    s.phase = "decision";
    s.decision = {
      kind: "market",
      card: "enc-m0",
      responder: 0,
      remaining: [],
    };
    const before = playerFinancials(s),
      sold = reduceGame(s, { type: "SELL", assetId: "studio" });
    expect(playerFinancials(sold).cash).toBe(before.cash + 3700000);
    expect(playerFinancials(sold).debt).toBe(before.debt - 3300000);
  });
  it("audits a sourced expense once and persists a pending worksheet", () => {
    const s = game();
    s.config.accounting = "manual";
    s.players[0].position = 3;
    s.rng = 1;
    s.decks.expense = ["enc-e0"];
    const before = playerFinancials(s),
      pending = reduceGame(s, { type: "ROLL" });
    expect(pending.pending?.receipt.title).toBe("Subscription Creep");
    const loaded = validateSave(
      JSON.parse(JSON.stringify(pending)),
    ) as GameState;
    const committed = reduceGame(loaded, {
      type: "SUBMIT",
      values: Object.fromEntries(
        loaded.pending!.fields.map((key) => [
          key,
          String(loaded.pending!.receipt.after[key] / 100),
        ]),
      ),
    });
    expect(playerFinancials(committed).cash).toBe(before.cash - 20000);
    expect(
      committed.history.filter((h) => h.title === "Subscription Creep"),
    ).toHaveLength(1);
  });
});
