import { describe, it, expect } from "vitest";
import {
  assetFromDeal,
  createGame,
  playerFinancials,
  reduceGame,
} from "./engine";
import { npcStep } from "./npc";
import { coaching } from "./review";
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
