import { describe, expect, it } from "vitest";
import {
  deals,
  dreams,
  expenses,
  fastDeals,
  innerBoard,
  largeDeals,
  markets,
  outerBoard,
  professions,
  smallDeals,
} from "./content";
import {
  actingPlayer,
  assetFromDeal,
  createGame as baseCreateGame,
  finances,
  playerFinancials,
  reduceGame as rawReduceGame,
  salePrice,
} from "./engine";
import { chooseNpc, npcStep as rawNpcStep, npcView } from "./npc";
import { validateSave } from "./storage";
import type { Deal, GameAction, GameState, GameConfig } from "./types";
// These ledger tests dismiss presentation notices; review tests also cover
// continuing play while notifications remain unread.
function acknowledge(s: GameState): GameState {
  while (s.notices.length)
    s = rawReduceGame(s, { type: "ACKNOWLEDGE", id: s.notices[0].id });
  return s;
}
function reduceGame(s: GameState, a: GameAction) {
  return acknowledge(rawReduceGame(s, a));
}
function npcStep(s: GameState) {
  return acknowledge(rawNpcStep(acknowledge(s)));
}
const createGame = (options: Partial<GameConfig> = {}) =>
  baseCreateGame({
    liquidityRisk: false,
    principalRate: 0,
    economicCycles: false,
    ...options,
  });
const dollar = (n: number) => Math.round(n * 100);
const initial = () => createGame({ seed: 123, profession: "designer" });
function offer(s = initial(), card = smallDeals[0]): GameState {
  s.phase = "decision";
  s.decision = {
    kind: "opportunity",
    owner: 0,
    card: card.id,
    transferred: false,
  };
  return s;
}
function addAsset(s: GameState, card: Deal = smallDeals[0]) {
  s.players[0].assets.push(assetFromDeal(card, "owned"));
  return s;
}
describe("original content and setup", () => {
  it("contains the complete original content set and both boards", () => {
    expect([
      professions.length,
      smallDeals.length,
      largeDeals.length,
      markets.length,
      expenses.length,
      dreams.length,
      fastDeals.length,
      innerBoard.length,
      outerBoard.length,
    ]).toEqual([15, 44, 33, 36, 39, 8, 12, 24, 32]);
    expect(
      new Set(
        outerBoard.filter((s) => s.kind === "business").map((s) => s.content),
      ).size,
    ).toBe(12);
    expect(new Set(deals.map((d) => d.id)).size).toBe(deals.length);
  });
  it("starts all six participants with unique professions and the same multipliers", () => {
    const s = createGame({
      opponents: 5,
      startingCash: 2,
      livingExpenses: 1.25,
    });
    expect(new Set(s.players.map((p) => p.profession)).size).toBe(6);
    for (const p of s.players) {
      const pr = professions.find((v) => v.id === p.profession)!;
      expect(p.living).toBe(Math.round(pr.living * 1.25));
      expect(p.cash).toBe((pr.savings + playerFinancials(s, p).flow) * 2);
      expect(p.assets).toHaveLength(0);
      expect(p.children).toBe(0);
    }
  });
  it("rejects malformed match settings", () => {
    expect(() => createGame({ opponents: 9 })).toThrow();
    expect(() => createGame({ annualRate: 500 })).toThrow();
    expect(() => createGame({ seed: 0 })).toThrow();
  });
});
describe("ledger and financing", () => {
  it("charges 12% annual bank interest monthly and removes it on principal repayment", () => {
    const s = initial(),
      f = playerFinancials(s);
    const borrowed = reduceGame(s, { type: "BORROW", amount: dollar(1000) });
    expect(playerFinancials(borrowed).expenses).toBe(f.expenses + dollar(10));
    expect(borrowed.players[0].cash).toBe(s.players[0].cash + dollar(1000));
    const repaid = reduceGame(borrowed, {
      type: "REPAY",
      debtId: "bank",
      amount: dollar(1000),
    });
    expect(playerFinancials(repaid)).toEqual(f);
    expect(s.players[0].debts.some((d) => d.kind === "bank")).toBe(false);
    expect(() =>
      reduceGame(s, { type: "BORROW", amount: dollar(500) }),
    ).toThrow();
  });
  it("does not double-charge investment financing, then increases income on mortgage payoff", () => {
    const s = offer();
    s.players[0].cash = dollar(100000);
    const before = playerFinancials(s),
      card = smallDeals[0];
    const bought = reduceGame(s, { type: "BUY" }),
      f = playerFinancials(bought);
    expect(f.expenses).toBe(before.expenses);
    expect(f.passive).toBe(card.income);
    expect(f.debt).toBe(before.debt + card.mortgage);
    expect(f.cash).toBe(before.cash - card.down);
    const a = bought.players[0].assets[0];
    const paid = reduceGame(bought, { type: "REPAY", debtId: a.id });
    expect(playerFinancials(paid).passive).toBe(card.income + card.financing);
    expect(paid.players[0].assets[0].mortgage).toBe(0);
  });
  it("supports partial household repayments and blocks arbitrary asset sales", () => {
    const s = addAsset(initial());
    expect(() => reduceGame(s, { type: "SELL", assetId: "owned" })).toThrow(
      /market/,
    );
    s.players[0].cash = dollar(5000);
    const d = s.players[0].debts.find((d) => d.kind === "credit")!;
    const paid = reduceGame(s, {
      type: "REPAY",
      debtId: d.id,
      amount: dollar(1000),
    });
    expect(paid.players[0].cash).toBe(dollar(4000));
    expect(paid.players[0].debts.find((v) => v.id === d.id)?.principal).toBe(
      dollar(2000),
    );
  });
  it("settles mortgages and removes recurring income on an eligible sale", () => {
    const s = addAsset(initial());
    s.phase = "decision";
    s.decision = { kind: "market", card: "m6", responder: 0, remaining: [] };
    const a = s.players[0].assets[0],
      f = playerFinancials(s);
    const sold = reduceGame(s, { type: "SELL", assetId: a.id });
    expect(sold.players[0].cash).toBe(
      f.cash + salePrice(a, markets[6].multiplier),
    );
    expect(sold.players[0].assets).toHaveLength(0);
    expect(playerFinancials(sold).debt).toBe(f.debt - a.mortgage);
    expect(playerFinancials(sold).passive).toBe(0);
  });
  it("records share dividends in recurring income and a split preserves cost basis and dividends", () => {
    const s = addAsset(initial(), smallDeals[16]);
    const a = s.players[0].assets[0];
    s.phase = "decision";
    s.decision = { kind: "market", card: "m20", responder: 0, remaining: [] };
    const f = playerFinancials(s),
      split = reduceGame(s, { type: "PASS" });
    expect(split.players[0].assets[0].shares).toBe(a.shares * 2);
    expect(playerFinancials(split)).toEqual(f);
    split.phase = "decision";
    split.decision = {
      kind: "market",
      card: "m23",
      responder: 0,
      remaining: [],
    };
    const dividend = reduceGame(split, { type: "PASS" });
    expect(dividend.players[0].cash).toBe(
      split.players[0].cash +
        split.players[0].assets[0].shares * markets[23].amount,
    );
  });
  it("allows an eligible, accepted opportunity transfer without permitting asset transfers", () => {
    const s = offer();
    s.players[1].cash = dollar(60000);
    const before = s.players[0].cash;
    const next = reduceGame(s, {
      type: "TRANSFER",
      target: 1,
      price: dollar(100),
    });
    expect(next.players[0].cash).toBe(before + dollar(100));
    expect(next.players[0].assets).toHaveLength(0);
    expect(next.players[1].assets).toHaveLength(1);
    expect(next.players[1].cash).toBe(
      dollar(60000) - smallDeals[0].down - dollar(100),
    );
  });
});
describe("turns, hardship, and victory", () => {
  it("pays exactly once when landing on Payday", () => {
    const s = initial();
    s.players[0].position = 7;
    s.rng = 1;
    const f = playerFinancials(s),
      next = reduceGame(s, { type: "ROLL" });
    expect(next.dice).toEqual([1]);
    expect(next.players[0].position).toBe(8);
    expect(next.players[0].cash).toBe(f.cash + f.flow);
    expect(next.receipts).toHaveLength(1);
  });
  it("adds a child and household cost, with a three-child maximum", () => {
    const s = initial();
    s.players[0].position = 6;
    s.rng = 1;
    const f = playerFinancials(s),
      next = reduceGame(s, { type: "ROLL" });
    expect(next.players[0].children).toBe(1);
    expect(playerFinancials(next).expenses).toBe(
      f.expenses + s.players[0].childCost,
    );
    s.players[0].children = 3;
    expect(reduceGame(s, { type: "ROLL" }).players[0].children).toBe(3);
  });
  it("downsizing charges a month of expenses, ends charity, and loses two turns", () => {
    const s = initial();
    s.players[0].position = 12;
    s.players[0].charity = 1;
    s.rng = 1;
    const f = playerFinancials(s),
      next = reduceGame(s, { type: "ROLL", dice: 1 });
    expect(next.players[0].skip).toBe(2);
    expect(next.players[0].charity).toBe(0);
    expect(next.players[0].cash).toBe(f.cash - f.expenses);
    next.phase = "roll";
    expect(reduceGame(next, { type: "ROLL" }).players[0].skip).toBe(1);
  });
  it("offers emergency borrowing and resolves a mandatory expense after funds are raised", () => {
    const s = initial();
    s.phase = "decision";
    s.players[0].cash = 0;
    s.decision = {
      kind: "insolvency",
      amount: dollar(600),
      title: "Emergency repair",
    };
    expect(() => reduceGame(s, { type: "PASS" })).toThrow();
    const next = reduceGame(
      reduceGame(s, { type: "BORROW", amount: dollar(1000) }),
      { type: "PASS" },
    );
    expect(next.players[0].cash).toBe(dollar(400));
    expect(next.decision).toBeNull();
  });
  it("uses half-down-payment distress recovery and eliminates unrecoverable players", () => {
    const s = addAsset(initial());
    s.players[0].cash = 0;
    s.phase = "decision";
    s.decision = { kind: "insolvency", amount: dollar(500), title: "Bill" };
    const next = reduceGame(s, { type: "LIQUIDATE", assetId: "owned" });
    expect(next.players[0].cash).toBe(smallDeals[0].down / 2);
    expect(next.players[0].assets).toHaveLength(0);
    const doomed = initial();
    doomed.players[0].salary = 0;
    doomed.players[0].cash = 0;
    doomed.phase = "decision";
    doomed.decision = {
      kind: "insolvency",
      amount: dollar(1000),
      title: "Shortfall",
    };
    const out = reduceGame(doomed, { type: "BANKRUPT" });
    expect(out.players[0].eliminated).toBe(true);
    expect(out.players[0].debtRelief).toBe(true);
  });
  it("can recover from bankruptcy and skips three turns", () => {
    const s = initial();
    s.players[0].cash = 0;
    s.players[0].assets.push({
      ...assetFromDeal(smallDeals[0], "recovery"),
      distress: dollar(3000),
      income: -dollar(5000),
    });
    s.phase = "decision";
    s.decision = {
      kind: "insolvency",
      amount: dollar(500),
      title: "Shortfall",
    };
    const next = reduceGame(s, { type: "BANKRUPT" });
    expect(next.players[0].eliminated).toBe(false);
    expect(next.players[0].skip).toBe(3);
    expect(next.players[0].cash).toBe(dollar(1000));
  });
  it("requires strictly greater passive income to escape, then preserves finances on the Fast Track", () => {
    const s = addAsset(initial());
    s.players[0].assets[0].income = playerFinancials(s).expenses;
    const exact = reduceGame(s, { type: "ROLL" });
    expect(exact.players[0].stage).toBe("rat");
    s.players[0].assets[0].income++;
    const before = playerFinancials(s),
      next = reduceGame(s, { type: "ROLL" });
    expect(next.players[0].stage).toBe("fast");
    expect(next.players[0].entryIncome).toBe(before.passive);
    expect(next.players[0].salary).toBe(s.players[0].salary);
    expect(next.players[0].debts).toEqual(s.players[0].debts);
    expect(next.dice).toHaveLength(2);
    expect(next.players[0].assets[0].income).toBe(before.passive);
  });
  it("finishes freedom mode at the beginning of the qualifying turn", () => {
    const s = addAsset(createGame({ victory: "freedom" }));
    s.players[0].assets[0].income = playerFinancials(s).expenses + 1;
    const next = reduceGame(s, { type: "ROLL" });
    expect(next.phase).toBe("finished");
    expect(next.winners).toEqual(["p0"]);
  });
  it("wins through either the additional income goal or the selected dream", () => {
    const s = offer();
    s.players[0].stage = "fast";
    s.players[0].cash = dollar(100000);
    s.players[0].entryIncome = 0;
    s.config.incomeGoal = smallDeals[0].income;
    expect(reduceGame(s, { type: "BUY" }).winners).toEqual(["p0"]);
    const t = initial();
    t.phase = "decision";
    t.players[0].stage = "fast";
    t.players[0].cash = dollar(500000);
    t.decision = { kind: "dream", id: t.players[0].dream };
    const next = reduceGame(t, { type: "BUY" });
    expect(next.players[0].dreamOwned).toBe(true);
    expect(next.winners).toEqual(["p0"]);
  });
  it("counts a round only after all active seats and preserves tied results", () => {
    const s = createGame({
      opponents: 1,
      profession: "designer",
      roundLimit: 25,
    });
    s.round = 25;
    s.current = 1;
    s.phase = "end";
    s.players[1] = {
      ...structuredClone(s.players[0]),
      id: "p1",
      human: false,
      name: "Maya",
    };
    const next = reduceGame(s, { type: "END" });
    expect(next.phase).toBe("finished");
    expect(next.winners).toEqual(["p0", "p1"]);
  });
});
describe("guided accounting and persistence", () => {
  it("preserves unsubmitted worksheet drafts without posting financial changes", () => {
    const s = initial();
    s.config.accounting = "manual";
    const pending = reduceGame(s, { type: "BORROW", amount: dollar(1000) });
    const draft = reduceGame(pending, {
      type: "DRAFT",
      field: "cash",
      value: "8,390.00",
    });
    const saved = validateSave(JSON.parse(JSON.stringify(draft)));
    expect(saved.pending?.values.cash).toBe("8,390.00");
    expect(saved.players[0].cash).toBe(s.players[0].cash);
    expect(saved.receipts).toHaveLength(0);
  });
  it("rejects corrupted deck IDs, decisions, and pending balances", () => {
    const s = initial();
    s.decks.small = ["missing-card"];
    expect(() => validateSave(s)).toThrow();
    const bad = initial();
    bad.phase = "decision";
    bad.decision = {
      kind: "market",
      card: "missing-market",
      responder: 0,
      remaining: [],
    };
    expect(() => validateSave(bad)).toThrow();
    const manual = initial();
    manual.config.accounting = "manual";
    const pending = reduceGame(manual, {
      type: "BORROW",
      amount: dollar(1000),
    });
    pending.pending!.next.cash++;
    expect(() => validateSave(pending)).toThrow();
  });
  it("stages a transaction, identifies wrong totals, and commits exactly once", () => {
    const s = initial();
    s.config.accounting = "manual";
    const before = s.players[0].cash;
    const pending = reduceGame(s, { type: "BORROW", amount: dollar(1000) });
    expect(pending.players[0].cash).toBe(before);
    expect(pending.pending).not.toBeNull();
    expect(() => reduceGame(pending, { type: "END" })).toThrow(/worksheet/);
    const wrong = reduceGame(pending, {
      type: "SUBMIT",
      values: { cash: "wrong" },
    });
    expect(wrong.pending?.errors).toContain("cash");
    expect(wrong.receipts).toHaveLength(0);
    const recovered = validateSave(JSON.parse(JSON.stringify(wrong)));
    const values = Object.fromEntries(
      recovered.pending!.fields.map((k) => [
        k,
        (recovered.pending!.receipt.after[k] / 100).toFixed(2),
      ]),
    );
    const next = reduceGame(recovered, { type: "SUBMIT", values });
    expect(next.pending).toBeNull();
    expect(next.players[0].cash).toBe(before + dollar(1000));
    expect(next.receipts).toHaveLength(1);
    expect(() => reduceGame(next, { type: "SUBMIT", values })).toThrow();
  });
  it("serializes a pending Payday and continues to its landing without paying twice", () => {
    const s = initial();
    s.config.accounting = "manual";
    s.players[0].position = 7;
    s.rng = 1;
    const pending = reduceGame(s, { type: "ROLL" });
    const loaded = validateSave(JSON.parse(JSON.stringify(pending)));
    const values = Object.fromEntries(
      loaded.pending!.fields.map((k) => [
        k,
        String(loaded.pending!.receipt.after[k] / 100),
      ]),
    );
    const next = reduceGame(loaded, { type: "SUBMIT", values });
    expect(next.effects).toHaveLength(0);
    expect(next.phase).toBe("end");
    expect(next.receipts).toHaveLength(1);
  });
  it("resumes the same roll and deck order and rejects damaged saves", () => {
    const s = initial(),
      copy = validateSave(JSON.parse(JSON.stringify(s)));
    expect(reduceGame(copy, { type: "ROLL" })).toEqual(
      reduceGame(s, { type: "ROLL" }),
    );
    expect(() => validateSave({ ...s, version: 99 })).toThrow();
    const bad = initial();
    bad.players[0].cash = NaN;
    expect(() => validateSave(bad)).toThrow();
    expect(() => validateSave({ ...s, players: [] })).toThrow();
  });
});
describe("NPC fairness and complete matches", () => {
  it("completes both natural victory modes without a round limit", () => {
    for (const victory of ["freedom", "full"] as const) {
      let s = createGame({
        seed: 20261103,
        victory,
        difficulty: "hard",
        opponents: 3,
      });
      let count = 0;
      while (s.phase !== "finished" && count++ < 12000)
        s = actingPlayer(s).human
          ? reduceGame(s, chooseNpc(npcView(s)).action)
          : npcStep(s);
      expect(s.phase, `${victory}: ${count} actions, round ${s.round}`).toBe(
        "finished",
      );
      expect(s.winners.length).toBeGreaterThan(0);
      expect(s.finishReason).not.toContain("Round limit");
      const resumed = validateSave(s);
      for (const player of resumed.players) {
        expect(
          resumed.history.filter((h) => h.player === player.id).at(-1)?.values,
        ).toEqual(playerFinancials(resumed, player));
      }
      console.info(
        `${victory}: ${s.round} rounds, ${count} actions. ${s.finishReason}`,
      );
    }
  }, 60000);
  it("provides a filtered view with no RNG, decks, or future rolls", () => {
    const s = initial();
    const view = npcView(s);
    expect(view).not.toHaveProperty("rng");
    expect(view).not.toHaveProperty("decks");
    expect(view).not.toHaveProperty("dice");
    view.player.cash = 0;
    expect(s.players[0].cash).toBeGreaterThan(0);
  });
  it("uses actual reserves and returns when explaining a decision", () => {
    const s = offer();
    s.players[0].profile = "cautious";
    s.players[0].cash = dollar(100);
    const result = chooseNpc(npcView(s));
    expect(result.action.type).toBe("PASS");
    expect(result.reason).toMatch(/reserve|strategy|wait/);
  });
  it("finishes seeded matches at every difficulty without illegal or stalled turns", () => {
    const summary: Record<string, { wins: number; freedom: number }> = {};
    for (const difficulty of ["easy", "standard", "hard"] as const) {
      let wins = 0,
        freedom = 0;
      for (let seed = 1; seed <= 12; seed++) {
        let s = createGame({ seed, opponents: 3, roundLimit: 25, difficulty });
        let steps = 0;
        while (s.phase !== "finished" && steps++ < 2500) {
          s = actingPlayer(s).human
            ? reduceGame(s, chooseNpc(npcView(s)).action)
            : npcStep(s);
          for (const p of s.players) {
            const f = finances(p, s.config.annualRate);
            expect(Number.isSafeInteger(f.cash) && f.cash >= 0).toBe(true);
            expect(f.flow).toBe(f.income - f.expenses);
            expect(f.netWorth).toBe(f.cash + f.assets - f.debt);
          }
        }
        expect(s.phase, `seed ${seed}, ${difficulty}, ${steps} actions`).toBe(
          "finished",
        );
        expect(s.winners.length).toBeGreaterThan(0);
        wins += s.winners.includes("p0") ? 1 : 0;
        freedom +=
          s.players.reduce(
            (n, p) =>
              n +
              playerFinancials(s, p).passive /
                Math.max(1, playerFinancials(s, p).expenses),
            0,
          ) / s.players.length;
      }
      summary[difficulty] = { wins, freedom: Math.round((freedom / 12) * 100) };
    }
    console.info(
      "Common-seed match comparison (12 seeds per difficulty):",
      summary,
    );
  }, 60000);
});
