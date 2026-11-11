import { createLegacyGame as createGame } from "../../tests/legacyGame";
import { describe, it, expect } from "vitest";
import {
  actingPlayer,
  assetFromDeal,
  playerFinancials,
  reduceGame,
  salePrice,
} from "./engine";
import {
  assetIncome,
  assetIncomeBreakdown,
  assetValue,
  debtPayment,
  distressValue,
  economicEvents,
  effectiveDeal,
  installment,
  payInstallment,
  requiredReserve,
} from "./economy";
import { chooseNpc, npcStep, npcView } from "./npc";
import { validateSave } from "./storage";
import { smallDeals, professions } from "./content";
import type { GameConfig, GameState } from "./types";
const game = (options: Partial<GameConfig> = {}) =>
  createGame({
    profession: "designer",
    seed: 123,
    liquidityRisk: false,
    principalRate: 0,
    economicCycles: false,
    ...options,
  });
const audit = (s: GameState) =>
  reduceGame(s, {
    type: "SUBMIT",
    values: Object.fromEntries(
      s.pending!.fields.map((k) => [
        k,
        String(s.pending!.receipt.after[k] / 100),
      ]),
    ),
  });
function cycle(s: GameState, id: string, round = 11) {
  s.round = round;
  s.phase = "roll";
  s.decision = null;
  s.effects = [];
  s.economy.deck = [id];
  return reduceGame(s, { type: "ROLL" });
}
describe("proportional debt repayment", () => {
  it("accepts cents and reduces household payments by the original balance ratio", () => {
    const s = game(),
      before = playerFinancials(s);
    const next = reduceGame(s, {
      type: "REPAY",
      debtId: "credit",
      amount: 150050,
    });
    const debt = next.players[0].debts.find((d) => d.id === "credit")!;
    expect(debt.principal).toBe(149950);
    expect(debt.payment).toBe(4499);
    expect(playerFinancials(next).cash).toBe(before.cash - 150050);
    expect(playerFinancials(next).expenses).toBe(before.expenses - 4501);
  });
  it("uses a payment basis to avoid accumulating rounding errors", () => {
    let s = game();
    for (let i = 0; i < 100; i++)
      s = reduceGame(s, { type: "REPAY", debtId: "credit", amount: 1 });
    expect(s.players[0].debts.find((d) => d.id === "credit")!.payment).toBe(
      8997,
    );
    expect(validateSave(s).players).toEqual(s.players);
  });
  it("reduces property financing proportionally without double-counting it as an expense", () => {
    const s = game();
    s.players[0].cash = 100000000;
    s.players[0].assets = [assetFromDeal(smallDeals[0], "rental")];
    const f = playerFinancials(s),
      a = s.players[0].assets[0];
    const next = reduceGame(s, {
      type: "REPAY",
      debtId: a.id,
      amount: a.mortgage / 2,
    });
    expect(next.players[0].assets[0].financing).toBe(a.financing / 2);
    expect(playerFinancials(next).passive).toBe(f.passive + a.financing / 2);
    expect(playerFinancials(next).expenses).toBe(f.expenses);
    expect(playerFinancials(next).netWorth).toBe(f.netWorth);
  });
  it("accepts a custom bank repayment and removes paid-off debts", () => {
    let s = reduceGame(game(), { type: "BORROW", amount: 100000 });
    s = reduceGame(s, { type: "REPAY", debtId: "bank", amount: 12345 });
    expect(s.players[0].debts.find((d) => d.id === "bank")!.principal).toBe(
      87655,
    );
    s = reduceGame(s, { type: "REPAY", debtId: "bank", amount: 87655 });
    expect(s.players[0].debts.some((d) => d.id === "bank")).toBe(false);
  });
  it.each([0, -1, 1.5, 300001, NaN])(
    "rejects an invalid repayment %s",
    (amount) => {
      expect(() =>
        reduceGame(game(), { type: "REPAY", debtId: "credit", amount }),
      ).toThrow();
    },
  );
});
describe("scheduled principal", () => {
  it("leaves cash and debt unchanged when scheduled payments are disabled", () => {
    const p = game().players[0];
    p.assets = [assetFromDeal(smallDeals[0], "rental")];
    const before = structuredClone(p);
    payInstallment(p, 0);
    expect(p).toEqual(before);
  });
  it("pays 1% of every outstanding balance once per round", () => {
    const s = game({ principalRate: 1 });
    s.phase = "end";
    s.players[0].assets = [assetFromDeal(smallDeals[0], "rental")];
    const f = playerFinancials(s),
      due = installment(s.players[0], 1);
    const next = reduceGame(s, { type: "END" });
    expect(next.current).toBe(1);
    expect(playerFinancials(next, next.players[0]).cash).toBe(f.cash - due);
    expect(playerFinancials(next, next.players[0]).debt).toBe(f.debt - due);
    expect(next.economy.principalPaid.p0).toBe(1);
    expect(
      next.history.filter((h) => h.title === "Scheduled principal payment"),
    ).toHaveLength(1);
  });
  it("persists manual principal drafts and cannot charge the same round twice", () => {
    const s = game({ principalRate: 1, accounting: "manual" });
    s.phase = "end";
    const pending = reduceGame(s, { type: "END" });
    expect(pending.current).toBe(0);
    expect(pending.pending).not.toBeNull();
    const committed = audit(validateSave(JSON.parse(JSON.stringify(pending))));
    const cash = committed.players[0].cash;
    const ended = reduceGame(committed, { type: "END" });
    expect(ended.players[0].cash).toBe(cash);
    expect(
      ended.history.filter((h) => h.title === "Scheduled principal payment"),
    ).toHaveLength(1);
  });
  it("handles an unaffordable installment and recomputes it after borrowing", () => {
    const s = game({ principalRate: 1 });
    s.players[0].debts = [
      {
        id: "bank",
        kind: "bank",
        principal: 100000,
        payment: 0,
        name: "Bank loan",
      },
    ];
    s.players[0].cash = 0;
    s.phase = "end";
    const due = reduceGame(s, { type: "END" });
    expect(due.decision).toMatchObject({
      kind: "insolvency",
      principal: true,
      amount: 1000,
    });
    const borrowed = reduceGame(due, { type: "BORROW", amount: 100000 });
    expect(borrowed.decision).toMatchObject({ amount: 2000 });
    const paid = reduceGame(borrowed, { type: "PASS" });
    expect(paid.players[0].cash).toBe(98000);
    expect(paid.players[0].debts[0].principal).toBe(198000);
    expect(reduceGame(paid, { type: "END" }).players[0].cash).toBe(98000);
  });
  it("does not remove scheduled principal again at Payday", () => {
    const s = game({ principalRate: 1 });
    s.phase = "end";
    const ended = reduceGame(s, { type: "END" });
    ended.current = 0;
    ended.phase = "roll";
    ended.players[0].position = 7;
    ended.rng = 1;
    const cash = ended.players[0].cash,
      flow = playerFinancials(ended).flow;
    const next = reduceGame(ended, { type: "ROLL" });
    expect(next.players[0].cash).toBe(cash + flow);
  });
});
describe("liquidity risk", () => {
  it("gives every new profession the same reserve treatment", () => {
    for (const profession of professions) {
      const s = game({
        profession: profession.id,
        liquidityRisk: true,
        startingCash: 0.5,
      });
      expect(s.players.every((p) => p.cash > requiredReserve(p))).toBe(true);
    }
  });
  it("forces a half-equity asset sale and resumes the interrupted turn", () => {
    const s = game({ liquidityRisk: true });
    s.players[0].debts = [];
    s.players[0].assets = [assetFromDeal(smallDeals[0], "rental")];
    s.players[0].cash = 100000;
    const before = s.players[0].assets[0],
      recovery = distressValue(s, before);
    const crisis = reduceGame(s, { type: "ROLL" });
    expect(crisis.decision).toEqual({ kind: "liquidity", resume: "roll" });
    expect(crisis.notices.some((n) => n.kind === "risk")).toBe(true);
    expect(() =>
      reduceGame(crisis, { type: "BORROW", amount: 100000 }),
    ).toThrow(/liquidity/);
    const sold = reduceGame(crisis, { type: "LIQUIDATE", assetId: "rental" });
    expect(sold.phase).toBe("roll");
    expect(sold.players[0].cash).toBe(100000 + recovery);
    expect(sold.players[0].assets).toHaveLength(0);
    expect(playerFinancials(sold).debt).toBe(0);
  });
  it("checks a strict below threshold and permits exactly 10%", () => {
    const s = game({ liquidityRisk: true });
    s.players[0].cash = requiredReserve(s.players[0]);
    s.rng = 1;
    expect(reduceGame(s, { type: "ROLL" }).decision?.kind).not.toBe(
      "liquidity",
    );
  });
  it("suppresses automatic warning hints in guided manual mode but retains the recovery rule", () => {
    const s = game({ liquidityRisk: true, accounting: "manual" });
    s.players[0].cash = 0;
    const crisis = reduceGame(s, { type: "ROLL" });
    expect(crisis.decision?.kind).toBe("liquidity");
    expect(crisis.notices.some((n) => n.kind === "risk")).toBe(false);
  });
  it("eliminates unresolved liquidity bankruptcy rather than stalling", () => {
    const s = game({ liquidityRisk: true });
    s.players[0].cash = 0;
    const crisis = reduceGame(s, { type: "ROLL" });
    const bankrupt = reduceGame(crisis, { type: "BANKRUPT" });
    expect(bankrupt.players[0].eliminated).toBe(true);
    expect(bankrupt.phase).toBe("end");
    expect(reduceGame(bankrupt, { type: "END" }).current).toBe(1);
  });
  it("exempts all three bankruptcy recovery turns before requiring the reserve again", () => {
    let s = game({ liquidityRisk: true });
    s.players[0].cash = 1;
    s.players[0].bankrupt = true;
    s.players[0].skip = 3;
    for (let turn = 0; turn < 3; turn++) {
      s.current = 0;
      s.phase = "roll";
      s = reduceGame(s, { type: "ROLL" });
      expect(s.phase).toBe("end");
      expect(s.players[0].bankrupt).toBe(true);
      s = reduceGame(s, { type: "END" });
      expect(s.current).toBe(1);
    }
    expect(s.players[0].bankrupt).toBe(false);
    s.current = 0;
    s.phase = "roll";
    expect(reduceGame(s, { type: "ROLL" }).decision?.kind).toBe("liquidity");
  });
});
describe("economic cycles and valuation", () => {
  it("includes 8 positive and 8 negative events with asset relationships and references", () => {
    expect(economicEvents.filter((c) => c.tone === "positive")).toHaveLength(8);
    expect(economicEvents.filter((c) => c.tone === "negative")).toHaveLength(8);
    expect(
      economicEvents.every(
        (c) =>
          c.affected &&
          c.scenario &&
          c.source.url.startsWith("https://") &&
          c.duration === 3,
      ),
    ).toBe(true);
  });
  it("marks existing properties down without reducing their principal or rent", () => {
    const s = game({ economicCycles: true });
    s.players[0].assets = [assetFromDeal(smallDeals[0], "rental")];
    const f = playerFinancials(s);
    const next = cycle(s, "housing-crash");
    expect(playerFinancials(next).assets).toBe(Math.round(f.assets * 0.8));
    expect(playerFinancials(next).debt).toBe(f.debt);
    expect(playerFinancials(next).passive).toBe(f.passive);
    expect(
      next.notices.some(
        (n) => n.kind === "cycle" && n.eventId === "housing-crash",
      ),
    ).toBe(true);
    expect(
      next.history.find(
        (h) => h.title === "Housing credit crunch" && h.player === "p0",
      )!.delta.assets,
    ).toBe(-f.assets * 0.2);
  });
  it("reprices new property purchases and eligible sales; recovery restores valuations", () => {
    let s = game({ economicCycles: true });
    s = cycle(s, "housing-crash");
    const nominal = smallDeals[0],
      card = effectiveDeal(s, nominal);
    expect(card.cost).toBe(nominal.cost * 0.8);
    s.phase = "decision";
    s.decision = {
      kind: "opportunity",
      owner: 0,
      card: nominal.id,
      transferred: false,
    };
    s = reduceGame(s, { type: "BUY" });
    const asset = s.players[0].assets[0];
    expect(assetValue(s, asset)).toBe(card.cost);
    expect(salePrice(asset, 1, s)).toBe(card.down);
    s = cycle(s, "rate-cut", 14);
    expect(assetValue(s, asset)).toBe(nominal.cost);
    expect(asset.cost).toBe(card.cost);
    expect(
      s.history.find((h) => h.title === "Credit becomes cheaper")!.note,
    ).toContain("Expired: Housing credit crunch");
  });
  it("doubles loan costs without double-counting investment financing", () => {
    const s = game({ economicCycles: true });
    s.players[0].assets = [assetFromDeal(smallDeals[0], "rental")];
    s.players[0].debts.push({
      id: "bank",
      kind: "bank",
      name: "Bank loan",
      principal: 100000,
      payment: 0,
    });
    const f = playerFinancials(s),
      a = s.players[0].assets[0],
      loanCosts = s.players[0].debts.reduce((v, d) => v + debtPayment(s, d), 0);
    const next = cycle(s, "rate-hike");
    expect(playerFinancials(next).expenses).toBe(f.expenses + loanCosts);
    expect(playerFinancials(next).passive).toBe(f.passive - a.financing);
    expect(playerFinancials(next).debt).toBe(f.debt);
  });
  it.each(["before", "during"])(
    "explains Corner shop unit's -$445 cash flow when bought %s a rate hike, then restores normal income",
    (timing) => {
      let s = game({ economicCycles: true });
      s.players[0].cash = 10000000;
      const definition = smallDeals.find((c) => c.id === "sp6")!;
      expect(definition.name).toBe("Corner shop unit");
      expect(definition.mortgage).toBe(11570000);
      expect(
        assetIncomeBreakdown(undefined, assetFromDeal(definition, "shop")),
      ).toEqual({ operating: 94300, financing: 69400, net: 24900 });

      if (timing === "during") s = cycle(s, "rate-hike");
      s.phase = "decision";
      s.decision = {
        kind: "opportunity",
        owner: 0,
        card: definition.id,
        transferred: false,
      };
      const preview = assetFromDeal(effectiveDeal(s, definition), "preview"),
        before = playerFinancials(s);
      s = reduceGame(s, { type: "BUY" });
      expect(playerFinancials(s).passive).toBe(assetIncome(s, preview));
      expect(playerFinancials(s).expenses).toBe(before.expenses);
      expect(s.receipts[0].after).toEqual(playerFinancials(s));
      if (timing === "before") s = cycle(s, "rate-hike");
      const asset = s.players[0].assets[0];
      expect(asset.income).toBe(24900);
      expect(asset.financing).toBe(69400);
      expect(assetIncomeBreakdown(s, asset)).toEqual({
        operating: 94300,
        financing: 138800,
        net: -44500,
      });
      expect(playerFinancials(s).passive).toBe(-44500);

      s = validateSave(JSON.parse(JSON.stringify(s)));
      expect(assetIncome(s, s.players[0].assets[0])).toBe(-44500);
      // Isolate expiry from the next economic event, which would also reprice income.
      s.config.economicCycles = false;
      s = cycle(s, "rate-hike", 14);
      expect(s.economy.active).toHaveLength(0);
      expect(playerFinancials(s).passive).toBe(24900);
      expect(s.receipts.find((r) => r.player === "p0")!.after).toEqual(
        playerFinancials(s),
      );
    },
  );
  it("raises rent before financing and leaves unrelated assets unchanged", () => {
    const s = game({ economicCycles: true });
    s.players[0].assets = [
      assetFromDeal(smallDeals[0], "rental"),
      assetFromDeal(smallDeals[16], "shares"),
    ];
    const a = s.players[0].assets[0],
      stock = s.players[0].assets[1];
    const next = cycle(s, "rent-boom");
    expect(assetIncome(next, a)).toBe(
      Math.round((a.income + a.financing) * 1.1) - a.financing,
    );
    expect(assetIncome(next, stock)).toBe(stock.income);
  });
  it("draws only once per cycle round and resumes the next roll and card deterministically", () => {
    const first = cycle(game({ economicCycles: true }), "housing-crash");
    const resumed = validateSave(JSON.parse(JSON.stringify(first)));
    for (const s of [first, resumed]) {
      s.current = 1;
      s.phase = "roll";
      s.decision = null;
      s.effects = [];
    }
    const a = reduceGame(first, { type: "ROLL" }),
      b = reduceGame(resumed, { type: "ROLL" });
    expect(a).toEqual(b);
    expect(a.economy.deck).toHaveLength(0);
    expect(a.notices.filter((n) => n.kind === "cycle")).toHaveLength(1);
  });
  it("does not expose the economic deck to NPC decisions", () => {
    const s = game({ economicCycles: true });
    s.economy.deck = ["rate-hike"];
    expect(npcView(s)).not.toHaveProperty("economy");
    expect(npcView(s)).not.toHaveProperty("deck");
  });
  it("migrates existing saves without adding cash or changing the next roll", () => {
    const old = JSON.parse(JSON.stringify(game()));
    const cash = old.players[0].cash,
      rng = old.rng;
    delete old.economy;
    delete old.config.liquidityRisk;
    delete old.config.principalRate;
    delete old.config.economicCycles;
    const loaded = validateSave(old);
    expect(loaded.config.principalRate).toBe(0);
    expect(loaded.config.liquidityRisk).toBe(true);
    expect(loaded.players[0].cash).toBe(cash);
    expect(loaded.rng).toBe(rng);
  });
  it("rejects corrupt cycles and amortization bases", () => {
    const s = game();
    s.economy.deck = ["missing-card"];
    expect(() => validateSave(s)).toThrow();
    const p = game();
    p.players[0].debts[0].paymentBasis = { principal: 0, payment: 12 };
    expect(() => validateSave(p)).toThrow();
  });
  it("finishes seeded matches with all new rules without illegal or stalled turns", () => {
    for (const difficulty of ["easy", "standard", "hard"] as const)
      for (let seed = 1; seed <= 4; seed++) {
        let s = game({
          seed,
          difficulty,
          liquidityRisk: true,
          principalRate: 1,
          economicCycles: true,
          opponents: 5,
          roundLimit: 25,
        });
        let steps = 0;
        while (s.phase !== "finished" && steps++ < 3500) {
          s = actingPlayer(s).human
            ? reduceGame(s, chooseNpc(npcView(s)).action)
            : npcStep(s);
          if (steps % 100 === 0) validateSave(s);
        }
        expect(s.phase, `${difficulty} seed ${seed}: ${steps} steps`).toBe(
          "finished",
        );
        expect(s.winners.length).toBeGreaterThan(0);
        const final = validateSave(s);
        for (const p of final.players) {
          const f = playerFinancials(final, p);
          expect(f.cash >= 0 && Number.isSafeInteger(f.cash)).toBe(true);
          expect(
            final.history.filter((h) => h.player === p.id).at(-1)?.values,
          ).toEqual(f);
        }
      }
  }, 60000);
});
