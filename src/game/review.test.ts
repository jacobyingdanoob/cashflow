import { createLegacyGame as createGame } from "../../tests/legacyGame";
import { describe, it, expect } from "vitest";
import { assetFromDeal, playerFinancials, reduceGame } from "./engine";
import { npcStep } from "./npc";
import { coaching, coachingRisk } from "./review";
import { validateSave } from "./storage";
import { smallDeals } from "./content";
import type { GameAction, GameState } from "./types";
function acknowledge(s: GameState): GameState {
  while (s.notices.length)
    s = reduceGame(s, { type: "ACKNOWLEDGE", id: s.notices[0].id });
  return s;
}
function act(s: GameState, a: GameAction) {
  return acknowledge(reduceGame(s, a));
}
function initial() {
  return createGame({
    profession: "designer",
    seed: 123,
    liquidityRisk: false,
    principalRate: 0,
    economicCycles: false,
  });
}
describe("non-blocking activity", () => {
  it("does not block actions or queued landings when notifications exist", () => {
    const s = initial();
    s.players[0].position = 7;
    s.rng = 0x12345678;
    const next = reduceGame(s, { type: "ROLL" });
    expect(next.notices.length).toBeGreaterThanOrEqual(2);
    expect(next.receipts).toHaveLength(2);
    expect(next.effects).toHaveLength(0);
    expect(() => reduceGame(next, { type: "END" })).not.toThrow();
  });
  it("dismisses any notification by id, idempotently, without changing gameplay", () => {
    let s = reduceGame(initial(), { type: "BORROW", amount: 100000 });
    s = reduceGame(s, { type: "BORROW", amount: 100000 });
    const id = s.notices[1].id;
    const before = playerFinancials(s);
    const next = reduceGame(s, { type: "ACKNOWLEDGE", id });
    expect(next.notices).toHaveLength(1);
    expect(playerFinancials(next)).toEqual(before);
    expect(reduceGame(next, { type: "ACKNOWLEDGE", id })).toEqual(next);
  });
  it("lets the next NPC continue with the previous summary still present", () => {
    let s = initial();
    s.current = 1;
    let steps = 0;
    while (s.current === 1 && steps++ < 40) s = npcStep(s);
    expect(s.notices.some((n) => n.kind === "npc-turn")).toBe(true);
    const rng = s.rng;
    const next = npcStep(s);
    expect(next.rng).not.toBe(rng);
    expect(validateSave(next).notices.length).toBeGreaterThan(0);
  });
  it("keeps manual auditing as an input gate while notifications are non-blocking", () => {
    const s = initial();
    s.config.accounting = "manual";
    const pending = reduceGame(s, { type: "BORROW", amount: 100000 });
    expect(pending.notices.length).toBeGreaterThan(0);
    expect(() => reduceGame(pending, { type: "END" })).toThrow(/worksheet/);
    const values = Object.fromEntries(
      pending.pending!.fields.map((k) => [
        k,
        String(pending.pending!.receipt.after[k] / 100),
      ]),
    );
    const committed = reduceGame(pending, { type: "SUBMIT", values });
    expect(committed.pending).toBeNull();
    expect(
      committed.history.filter((h) => h.title === "Bank loan"),
    ).toHaveLength(1);
  });
});
describe("persistent financial history and coaching", () => {
  it("retains the complete event history after the short receipt list is trimmed", () => {
    let s = initial();
    for (let i = 0; i < 70; i++) s = act(s, { type: "BORROW", amount: 100000 });
    expect(s.receipts).toHaveLength(60);
    expect(s.history.filter((h) => h.kind === "transaction")).toHaveLength(70);
    expect(s.history[0].kind).toBe("start");
    expect(s.history.filter((h) => h.title === "Bank loan")[0].delta.debt).toBe(
      100000,
    );
    expect(validateSave(JSON.parse(JSON.stringify(s))).history).toEqual(
      s.history,
    );
  });
  it("records the cause of income and financing changes for chart tooltips", () => {
    let s = initial();
    s.phase = "decision";
    s.decision = {
      kind: "opportunity",
      owner: 0,
      card: smallDeals[0].id,
      transferred: false,
    };
    s = act(s, { type: "BUY" });
    const bought = s.history.find((h) => h.title === "Bought Garden studio")!;
    expect(bought.delta.passive).toBe(smallDeals[0].income);
    expect(bought.delta.debt).toBe(smallDeals[0].mortgage);
    expect(bought.note).toContain("net of financing");
    s.phase = "decision";
    s.decision = { kind: "market", card: "m6", responder: 0, remaining: [] };
    s = act(s, { type: "SELL", assetId: s.players[0].assets[0].id });
    const sale = s.history.find((h) => h.title === "Sold Garden studio")!;
    expect(sale.delta.passive).toBe(-smallDeals[0].income);
    expect(sale.note).toContain("mortgage");
  });
  it("gives evidence-based borrowing, reserve, and payoff guidance", () => {
    let s = initial();
    s = act(s, { type: "BORROW", amount: 100000 });
    s = act(s, { type: "REPAY", debtId: "credit" });
    const tips = coaching(s);
    expect(tips.find((t) => t.id === "leverage")?.evidence).toContain("$1,000");
    expect(tips.find((t) => t.id === "repayment")?.evidence).toContain("$90");
    expect(
      tips.every((t) => t.evidence.length > 0 && t.suggestion.length > 0),
    ).toBe(true);
  });
  it("records passed affordable opportunities without pretending they were always bad decisions", () => {
    const s = initial();
    s.phase = "decision";
    s.decision = {
      kind: "opportunity",
      owner: 0,
      card: smallDeals[0].id,
      transferred: false,
    };
    const next = act(s, { type: "PASS" });
    expect(
      next.history.find((h) => h.kind === "decision")?.opportunity?.affordable,
    ).toBe(true);
    expect(coaching(next).find((t) => t.id === "offers")?.suggestion).toContain(
      "protect reserves",
    );
  });
  it("upgrades older saves without fabricating earlier financial history or changing RNG", () => {
    const s = initial();
    s.round = 7;
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.history;
    delete legacy.historyStartRound;
    delete legacy.notices;
    delete legacy.turnContext;
    const loaded = validateSave(legacy);
    expect(loaded.history).toHaveLength(s.players.length);
    expect(
      loaded.history.every(
        (h) => h.title === "History tracking started" && h.round === 7,
      ),
    ).toBe(true);
    expect(loaded.historyStartRound).toBe(7);
    expect(loaded.rng).toBe(s.rng);
    expect(loaded.decks).toEqual(s.decks);
  });
  it("keeps a migrated pending worksheet after its starting snapshot in history", () => {
    const started = initial();
    started.config.accounting = "manual";
    const legacy = JSON.parse(
      JSON.stringify(act(started, { type: "BORROW", amount: 100000 })),
    );
    const after = legacy.pending.receipt.after;
    delete legacy.history;
    delete legacy.historyStartRound;
    delete legacy.notices;
    delete legacy.turnContext;
    const loaded = validateSave(legacy);
    const committed = reduceGame(loaded, {
      type: "SUBMIT",
      values: Object.fromEntries(
        loaded.pending!.fields.map((k) => [k, String(after[k] / 100)]),
      ),
    });
    const history = committed.history
      .filter((h) => h.player === "p0")
      .sort((a, b) => a.id - b.id);
    expect(history.map((h) => h.kind)).toEqual(["start", "transaction"]);
    expect(history[1].values.cash).toBe(loaded.players[0].cash + 100000);
    expect(validateSave(committed).history).toEqual(committed.history);
  });
  it("labels final positions with the last completed round at the round limit", () => {
    const s = initial();
    s.config.roundLimit = 25;
    s.round = 25;
    s.current = s.players.length - 1;
    s.phase = "end";
    const finished = act(s, { type: "END" });
    expect(finished.phase).toBe("finished");
    expect(
      finished.history
        .filter((h) => h.kind === "finish")
        .every((h) => h.round === 25),
    ).toBe(true);
  });
  it("rejects damaged notices and financial history instead of silently losing them", () => {
    const s = initial();
    s.history[0].values.debt = NaN;
    expect(() => validateSave(s)).toThrow();
    const n = reduceGame(initial(), { type: "BORROW", amount: 100000 });
    n.notices[0].player = "missing-player";
    expect(() => validateSave(n)).toThrow();
    const missing = JSON.parse(JSON.stringify(initial()));
    delete missing.notices;
    expect(() => validateSave(missing)).toThrow();
    const empty = initial();
    empty.history = [];
    expect(() => validateSave(empty)).toThrow();
  });
});

function leveragedGame(cash = 5000000, debt = 49050000) {
  const s = initial();
  s.config.liquidityRisk = true;
  const p = s.players[0];
  p.cash = cash;
  p.salary = 400000;
  p.taxes = 0;
  p.living = 100000;
  p.children = 0;
  p.debts = [
    {
      id: "home",
      name: "Home mortgage",
      kind: "home",
      principal: debt,
      payment: 20000,
    },
  ];
  p.assets = [];
  s.history = s.history.filter((h) => h.player !== p.id);
  s.history.unshift({
    id: ++s.sequence,
    player: p.id,
    round: 1,
    kind: "start",
    title: "Starting finances",
    note: "",
    values: playerFinancials(s, p),
    delta: {},
  });
  return s;
}

describe("debt-aware risk coaching", () => {
  it("recognizes that $50,000 cash may leave only $950 for unexpected losses", () => {
    const s = leveragedGame(),
      risk = coachingRisk(s),
      tips = coaching(s),
      first = tips[0];
    expect(risk).toMatchObject({ reserve: 4905000, buffer: 95000 });
    expect(first.id).toBe("risk-buffer");
    expect(first.tone).toBe("improve");
    expect(first.evidence).toContain("$490,500.00");
    expect(first.evidence).toContain("$950.00 remained above");
    expect(first.evidence).toContain("$50.00 below the reserve");
    expect(first.evidence).not.toContain("scheduled principal");
    expect(tips.some((t) => t.id === "idle")).toBe(false);
    expect(tips.find((t) => t.id === "leverage")).toBeDefined();
  });

  it("respects the safe equality boundary and rounds the debt reserve up to a cent", () => {
    const safe = leveragedGame(5000000, 49000000),
      tight = leveragedGame(5000000, 49000001);
    expect(coaching(safe)[0].evidence).toContain(
      "would leave $0.00 above the required reserve",
    );
    expect(coachingRisk(tight).reserve).toBe(4900001);
    expect(coaching(tight)[0].evidence).toContain("$0.01 below the reserve");
  });

  it("includes investment mortgages without any personal borrowing history", () => {
    const s = leveragedGame();
    s.players[0].debts = [];
    s.players[0].assets = [
      { ...assetFromDeal(smallDeals[0], "test-property"), mortgage: 49050000 },
    ];
    expect(coachingRisk(s)).toMatchObject({ reserve: 4905000, buffer: 95000 });
    const leverage = coaching(s).find((t) => t.id === "leverage")!;
    expect(leverage.evidence).toContain(
      "$490,500.00, including investment mortgages",
    );
    expect(leverage.evidence).not.toContain("You took");
    expect(leverage.suggestion).toContain("avoid counting it twice");
  });

  it("budgets opted-in principal against both cash and the reduced reserve", () => {
    const s = leveragedGame(5000000, 49000000);
    s.config.principalRate = 1;
    expect(coachingRisk(s)).toMatchObject({
      scheduledPrincipal: 490000,
      bufferAfterPrincipal: -341000,
    });
    expect(coaching(s)[0].evidence).toContain(
      "scheduled principal payment of $4,900.00",
    );
    expect(coaching(s)[0].evidence).toContain("buffer of -$3,410.00");
    s.config.principalRate = 0;
    expect(coachingRisk(s).bufferAfterPrincipal).toBe(100000);
    expect(coaching(s)[0].evidence).not.toContain(
      "scheduled principal payment",
    );
  });

  it("flags repayments that save monthly costs but consume most of the shock buffer", () => {
    const s = act(leveragedGame(5020000), {
        type: "REPAY",
        debtId: "home",
        amount: 100000,
      }),
      tips = coaching(s),
      repayment = tips.find((t) => t.id === "repayment")!,
      reserve = tips.find((t) => t.id === "reserve")!;
    expect(repayment.tone).toBe("improve");
    expect(repayment.evidence).toContain(
      "cash buffer was $250.00, below the coaching target",
    );
    expect(repayment.suggestion).toContain("consuming $900 of shock buffer");
    expect(reserve.evidence).toContain("Repaid Home mortgage");
    expect(reserve.evidence).toContain(
      "$49,200.00 against total debt of $489,500.00",
    );
    expect(tips.some((t) => t.id === "idle")).toBe(false);
  });

  it("does not praise scheduled principal that leaves too little emergency cash", () => {
    const s = leveragedGame(5400000);
    s.config.principalRate = 1;
    s.phase = "end";
    const paid = act(s, { type: "END" }),
      tip = coaching(paid).find((t) => t.id === "principal")!;
    expect(tip.tone).toBe("improve");
    expect(tip.evidence).toContain(
      "buffer of $535.50, below the coaching target",
    );
  });

  it("distinguishes emergency cash advice from an optional reserve rule", () => {
    const s = leveragedGame();
    s.config.liquidityRisk = false;
    expect(coachingRisk(s)).toMatchObject({ reserve: 0, buffer: 5000000 });
    const tip = coaching(s).find((t) => t.id === "risk-buffer")!;
    expect(tip.evidence).toContain("The 10% reserve rule was off");
    expect(tip.evidence).toContain("would leave $49,000.00 in cash");
    expect(tip.evidence).not.toContain("below the reserve required");
    expect(coaching(s).some((t) => t.id === "idle")).toBe(true);
  });

  it("identifies only the cash left after debt reserve and emergency savings as investable", () => {
    const s = leveragedGame(6000000),
      idle = coaching(s).find((t) => t.id === "idle")!;
    expect(idle.evidence).toContain("$49,050.00 required against debt");
    expect(idle.evidence).toContain("$7,350.00 remained");
    expect(idle.suggestion).toContain("the full cash balance is not surplus");
  });

  it("connects recurring deficits to the buffer available for future Paydays", () => {
    const s = leveragedGame();
    s.players[0].salary = 0;
    const tip = coaching(s).find((t) => t.id === "cash-flow-risk")!;
    expect(tip.evidence).toContain(
      "consume $1,200.00 in cash, against $950.00 above",
    );
    expect(tip.suggestion).toContain("before expanding");
  });

  it("keeps an eliminated player's risk figures frozen as later play continues", () => {
    const s = leveragedGame(),
      p = s.players[0];
    p.elimination = {
      round: 4,
      reason: "Eliminated",
      financials: playerFinancials(s, p),
    };
    p.eliminated = true;
    const risk = coachingRisk(s),
      tips = coaching(s);
    s.round = 20;
    s.economy.active.push({ card: "rate-hike", start: 20, expires: 23 });
    expect(coachingRisk(s)).toEqual(risk);
    expect(coaching(s)).toEqual(tips);
  });
});
