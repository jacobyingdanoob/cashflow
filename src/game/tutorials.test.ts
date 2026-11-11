import { describe, expect, it } from "vitest";
import { createGame, reduceGame } from "./engine";
import { innerBoard } from "./content";
import { validateSave } from "./storage";
import { introduceSpace } from "./tutorials";
import type { GameState, SpaceKind } from "./types";

function game() {
  const s = createGame({
    tutorials: true,
    seed: 123,
    profession: "designer",
    liquidityRisk: false,
  });
  s.roleRevealed = s.tutorialDone = true;
  s.tutorialSeen = ["intro"];
  return s;
}
function land(kind: SpaceKind, s = game()) {
  s.phase = "roll";
  s.decision = null;
  s.effects = [];
  const position = innerBoard.findIndex((space) => space.kind === kind);
  s.players[0].position =
    (position + innerBoard.length - 1) % innerBoard.length;
  s.rng = 1; // This seed rolls one space.
  return reduceGame(s, { type: "ROLL" });
}
function finish(s: GameState) {
  for (const topic of s.tutorialQueue)
    s = reduceGame(s, { type: "TUTORIAL", key: topic });
  return s;
}

describe("reliable first-encounter tutorials", () => {
  it.each([
    ["opportunity", "space-opportunity"],
    ["market", "space-market"],
    ["expense", "space-life"],
    ["payday", "space-payday"],
    ["charity", "space-special"],
    ["downsized", "space-special"],
  ] as const)(
    "queues %s immediately, even if later messages overwrite the landing",
    (kind, topic) => {
      const next = land(kind);
      expect(next.tutorialQueue).toContain(topic);
      const after = finish(next);
      expect(after.tutorialSeen).toContain(topic);
      expect(land(kind, after).tutorialQueue).not.toContain(topic);
    },
  );

  it("teaches one of the three asset types on each of the first three opportunity visits", () => {
    let s = game();
    for (const lesson of ["asset-1", "asset-2", "asset-3"]) {
      s = land("opportunity", s);
      expect(
        s.tutorialQueue.filter((topic) => topic.startsWith("asset-")),
      ).toEqual([lesson]);
      s = finish(s);
    }
    expect(land("opportunity", s).tutorialQueue).toEqual([]);
  });

  it("introduces Payday when crossing it, before the landing lesson", () => {
    const s = game();
    s.players[0].position = 7;
    s.rng = 2688; // A two-space roll crosses Payday and lands on Opportunity.
    const next = reduceGame(s, { type: "ROLL" });
    expect(next.dice).toEqual([2]);
    expect(next.tutorialQueue).toEqual([
      "space-payday",
      "space-opportunity",
      "asset-1",
    ]);
  });

  it("does not duplicate a queued lesson, and NPC movement does not teach human spaces", () => {
    const s = game();
    introduceSpace(s, s.players[1], "market");
    expect(s.tutorialQueue).toEqual([]);
    introduceSpace(s, s.players[0], "market");
    introduceSpace(s, s.players[0], "market");
    expect(s.tutorialQueue).toEqual(["space-market"]);
  });

  it("persists queued lessons and worksheet state, and allows disabling without financial changes", () => {
    let s = land("expense");
    s.config.accounting = "manual";
    s = reduceGame(s, { type: "BORROW", amount: 100000 });
    const restored = validateSave(JSON.parse(JSON.stringify(s)));
    expect(restored.tutorialQueue).toEqual(s.tutorialQueue);
    expect(restored.pending).toEqual(s.pending);
    const disabled = reduceGame(restored, {
      type: "TUTORIAL_MODE",
      enabled: false,
    });
    expect(disabled.tutorialQueue).toEqual([]);
    expect(disabled.pending).toEqual(s.pending);
    expect(disabled.players).toEqual(s.players);
    expect(disabled.rng).toBe(s.rng);
    expect(land("market", gameWithoutTutorials()).tutorialQueue).toEqual([]);
  });

  it("migrates older saves and rejects invalid or repeated queued lessons", () => {
    const old = game() as Partial<GameState>;
    delete old.tutorialQueue;
    expect(validateSave(old).tutorialQueue).toEqual([]);
    for (const queue of [
      ["unknown"],
      ["intro"],
      ["space-market", "space-market"],
      null,
    ]) {
      const s = game();
      (s as unknown as { tutorialQueue: unknown }).tutorialQueue = queue;
      expect(() => validateSave(s)).toThrow();
    }
  });

  it("lets the guide finish or be disabled after a match-ending event", () => {
    const s = game();
    s.phase = "finished";
    s.tutorialQueue = ["space-payday"];
    expect(
      reduceGame(s, { type: "TUTORIAL", key: "space-payday" }).tutorialQueue,
    ).toEqual([]);
    expect(
      reduceGame(s, { type: "TUTORIAL_MODE", enabled: false }).config.tutorials,
    ).toBe(false);
  });
});
function gameWithoutTutorials() {
  const s = game();
  s.config.tutorials = false;
  return s;
}
