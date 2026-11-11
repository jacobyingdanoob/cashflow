import { createLegacyGame as createGame } from "../../tests/legacyGame";
import { describe, expect, it } from "vitest";
import { dreams, fastTrackBoard, outerBoard } from "./content";
import { playerFinancials, reduceGame } from "./engine";
import { noticeRelatesToPlayer } from "./activity";
import { personalReviewState } from "./review";
import { validateSave } from "./storage";
import type { GameConfig, GameState } from "./types";

const game = (config: Partial<GameConfig> = {}) =>
  createGame({
    profession: "designer",
    seed: 123,
    liquidityRisk: false,
    economicCycles: false,
    principalRate: 0,
    ...config,
  });
function eliminate(s: GameState) {
  s.players[0].salary = 0;
  s.players[0].cash = 0;
  s.phase = "decision";
  s.decision = { kind: "insolvency", amount: 100000, title: "Unpayable bill" };
  return reduceGame(s, { type: "BANKRUPT" });
}

describe("notification controls", () => {
  it("clears every notice without changing balances, history, pending books, or RNG", () => {
    let s = reduceGame(game(), { type: "BORROW", amount: 100000 });
    s.config.accounting = "manual";
    s = reduceGame(s, { type: "BORROW", amount: 100000 });
    expect(s.notices).toHaveLength(2);
    const cleared = reduceGame(s, { type: "CLEAR_NOTIFICATIONS" });
    expect(cleared).toEqual({ ...s, notices: [] });
    expect(reduceGame(cleared, { type: "CLEAR_NOTIFICATIONS" })).toEqual(
      cleared,
    );
    expect(validateSave(cleared).pending).toEqual(s.pending);
    const finished = {
      ...game(),
      phase: "finished" as const,
      notices: s.notices,
    };
    expect(
      reduceGame(finished, { type: "CLEAR_NOTIFICATIONS" }).notices,
    ).toEqual([]);
  });
  it("includes personal events and actual shared financial changes, excluding unrelated summaries", () => {
    const s = reduceGame(game(), { type: "BORROW", amount: 100000 }),
      own = s.notices[0],
      f = playerFinancials(s),
      npc = {
        ...own,
        kind: "npc-turn" as const,
        player: "p1",
        changes: [{ player: "p0", before: f, after: f }],
      };
    expect(noticeRelatesToPlayer(own, "p0")).toBe(true);
    expect(noticeRelatesToPlayer(npc, "p0")).toBe(false);
    expect(
      noticeRelatesToPlayer(
        {
          ...npc,
          changes: [
            {
              player: "p0",
              before: f,
              after: {
                ...f,
                assets: f.assets + 100,
                netWorth: f.netWorth + 100,
              },
            },
          ],
        },
        "p0",
      ),
    ).toBe(true);
    expect(
      noticeRelatesToPlayer({ ...npc, kind: "cycle", player: "p0" }, "p0"),
    ).toBe(false);
    expect(noticeRelatesToPlayer({ ...own, changes: [] }, "p0")).toBe(true);
  });
});

describe("dream spaces for each table", () => {
  it.each([1, 2, 3, 4, 5])(
    "creates one distinct dream per player with %s NPCs",
    (opponents) => {
      for (const dream of dreams) {
        const s = game({ opponents, dream: dream.id }),
          board = fastTrackBoard(s.players);
        expect(board).toHaveLength(32);
        expect(board.filter((v) => v.kind === "dream")).toHaveLength(
          opponents + 1,
        );
        expect(new Set(s.players.map((p) => p.dream)).size).toBe(opponents + 1);
        expect(
          new Set(
            board.filter((v) => v.kind === "dream").map((v) => v.content),
          ),
        ).toEqual(new Set(s.players.map((p) => p.dream)));
        expect(board.filter((v) => v.kind === "business")).toHaveLength(12);
        expect(board.filter((v) => v.kind === "payday")).toHaveLength(4);
        expect(board.filter((v) => v.kind === "opportunity")).toHaveLength(
          8 - opponents,
        );
        const copy = validateSave(JSON.parse(JSON.stringify(s)));
        expect(fastTrackBoard(copy.players)).toEqual(board);
        copy.players[1].eliminated = true;
        expect(fastTrackBoard(copy.players)).toEqual(board);
      }
      expect(outerBoard.filter((v) => v.kind === "dream")).toHaveLength(8);
    },
  );
  it("keeps shared dreams from older saves accessible once", () => {
    const s = game();
    s.players[1].dream = s.players[0].dream;
    const loaded = validateSave(JSON.parse(JSON.stringify(s)));
    expect(
      fastTrackBoard(loaded.players).filter(
        (v) => v.content === s.players[0].dream,
      ),
    ).toHaveLength(1);
  });
  it("uses the displayed chosen space for movement and dream victory", () => {
    const s = game({ dream: "forest" });
    s.players[0].stage = "fast";
    s.players[0].cash = 100000000;
    s.rng = 1;
    const landed = reduceGame(s, { type: "ROLL" });
    expect(landed.players[0].position).toBe(
      fastTrackBoard(s.players).findIndex((v) => v.content === "forest"),
    );
    expect(landed.decision).toEqual({ kind: "dream", id: "forest" });
    expect(reduceGame(landed, { type: "BUY" }).winners).toEqual(["p0"]);
  });
  it("notifies the human when an NPC visit raises the price of their dream", () => {
    const s = game();
    s.current = 1;
    s.players[1].stage = "fast";
    s.rng = 1;
    const next = reduceGame(s, { type: "ROLL" }),
      notice = next.notices.find(
        (n) => n.title === "Your dream price increased",
      )!;
    expect(notice).toBeDefined();
    expect(noticeRelatesToPlayer(notice, "p0")).toBe(true);
    expect(next.dreamVisits[s.players[0].dream]).toEqual(["p1"]);
  });
});

describe("personal game over and the final match", () => {
  it.each(["auto", "manual"] as const)(
    "records elimination only after required %s accounting is complete",
    (accounting) => {
      let s = eliminate(game({ accounting }));
      if (accounting === "manual") {
        expect(s.players[0].eliminated).toBe(false);
        expect(s.pending!.next.eliminated).toBe(true);
        s = validateSave(JSON.parse(JSON.stringify(s)));
        s = reduceGame(s, {
          type: "SUBMIT",
          values: Object.fromEntries(
            s.pending!.fields.map((k) => [
              k,
              String(s.pending!.receipt.after[k] / 100),
            ]),
          ),
        });
      }
      expect(s.players[0].eliminated).toBe(true);
      expect(s.players[0].elimination?.financials).toEqual(playerFinancials(s));
      expect(s.phase).toBe("end");
      expect(s.personalReviewSeen).toBe(false);
      const saved = validateSave(JSON.parse(JSON.stringify(s)));
      expect(saved.players[0].elimination).toEqual(s.players[0].elimination);
      expect(() =>
        reduceGame(saved, { type: "BORROW", amount: 100000 }),
      ).toThrow(/Eliminated/);
      const viewed = reduceGame(saved, { type: "ACKNOWLEDGE_GAME_OVER" });
      expect(validateSave(viewed).personalReviewSeen).toBe(true);
      expect(reduceGame(viewed, { type: "END" }).current).toBe(1);
    },
  );
  it("freezes exit finances and the personal review while NPCs continue through to a final report", () => {
    let s = eliminate(game({ economicCycles: true }));
    const view = personalReviewState(s),
      f = playerFinancials(s);
    s = reduceGame(s, { type: "END" });
    s.round = 11;
    s.economy.lastRound = 10;
    s.economy.deck = ["rate-hike"];
    s = reduceGame(s, { type: "ROLL" });
    expect(s.economy.active[0].card).toBe("rate-hike");
    expect(playerFinancials(s, s.players[0])).toEqual(f);
    expect(personalReviewState(s).history).toEqual(view.history);
    expect(personalReviewState(s).round).toBe(view.round);
    expect(
      validateSave(JSON.parse(JSON.stringify(s))).players[0].elimination,
    ).toEqual(view.players[0].elimination);
    s.config.roundLimit = 25;
    s.round = 25;
    s.current = 3;
    s.phase = "end";
    s.decision = null;
    s.effects = [];
    s = reduceGame(s, { type: "END" });
    expect(s.phase).toBe("finished");
    expect(s.winners).not.toContain("p0");
    expect(s.history.filter((h) => h.kind === "finish")).toHaveLength(4);
    expect(personalReviewState(s).history).toEqual(view.history);
    expect(playerFinancials(s, s.players[0])).toEqual(f);
  });
  it("migrates old eliminations without changing saved rolls or reopening an acknowledged review", () => {
    const s = eliminate(game()),
      legacy = JSON.parse(JSON.stringify(s));
    delete legacy.personalReviewSeen;
    delete legacy.players[0].elimination;
    const loaded = validateSave(legacy);
    expect(loaded.personalReviewSeen).toBe(false);
    expect(loaded.players[0].elimination?.financials).toEqual(
      s.players[0].elimination?.financials,
    );
    expect(loaded.rng).toBe(s.rng);
    expect(loaded.decks).toEqual(s.decks);
    const bad = structuredClone(s);
    bad.players[0].elimination!.financials.cash = NaN;
    expect(() => validateSave(bad)).toThrow();
    expect(() => validateSave({ ...s, personalReviewSeen: null })).toThrow();
  });
});
