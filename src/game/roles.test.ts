import { describe, it, expect } from "vitest";
import { professions } from "./content";
import { createGame, playerFinancials, reduceGame } from "./engine";
import { validateSave } from "./storage";
import { chooseNpc, npcView } from "./npc";
import type { RoleDifficulty } from "./types";
const tiers: RoleDifficulty[] = ["easy", "standard", "hard"];

describe("starting roles", () => {
  it("has five distinct roles per tier with ordered monthly surpluses", () => {
    expect(new Set(professions.map((p) => p.id)).size).toBe(15);
    const flows = tiers.map((difficulty) => {
      const roles = professions.filter((p) => p.difficulty === difficulty);
      expect(roles).toHaveLength(5);
      return roles.map((p) => {
        const s = createGame({ profession: p.id });
        expect(p.traits.length).toBeGreaterThanOrEqual(3);
        expect(p.pursue && p.avoid && p.debtStory).toBeTruthy();
        expect(playerFinancials(s).cash).toBeGreaterThan(0);
        return playerFinancials(s).flow;
      });
    });
    expect(Math.min(...flows[0])).toBeGreaterThan(Math.max(...flows[1]));
    expect(Math.min(...flows[1])).toBeGreaterThan(Math.max(...flows[2]));
    const debts = professions.map((p) =>
      p.debts.reduce((sum, d) => sum + d.principal, 0),
    );
    expect(Math.min(...debts)).toBeLessThan(1000000);
    expect(Math.max(...debts)).toBeGreaterThan(40000000);
  });
  it("draws a seeded role in the selected tier and gives every opponent the same start", () => {
    for (const roleDifficulty of tiers) {
      const seen = new Set<string>();
      for (let sample = 1; sample <= 100; sample++) {
        const seed = (sample * 2654435761) >>> 0;
        const options = { roleDifficulty, seed, opponents: (sample % 5) + 1 };
        const s = createGame(options);
        expect(s).toEqual(createGame(options));
        const role = professions.find((p) => p.id === s.players[0].profession)!;
        expect(role.difficulty).toBe(roleDifficulty);
        expect(s.players).toHaveLength(options.opponents + 1);
        expect(new Set(s.players.map((p) => p.profession)).size).toBe(1);
        const initial = playerFinancials(s, s.players[0]);
        for (const player of s.players) {
          expect(playerFinancials(s, player)).toEqual(initial);
          expect(s.history.find((h) => h.player === player.id)?.values).toEqual(
            initial,
          );
        }
        seen.add(role.id);
      }
      expect(seen.size).toBe(5);
    }
  });
  it.each([false, true])(
    "keeps explicit roles and sandbox finances equal with liquidity risk %s",
    (liquidityRisk) => {
      const settings = [
        { startingCash: 0.5, livingExpenses: 1.25, annualRate: 24 },
        { startingCash: 1, livingExpenses: 1, annualRate: 12 },
        { startingCash: 2, livingExpenses: 0.75, annualRate: 6 },
        { startingCash: 5, livingExpenses: 1.25, annualRate: 18 },
      ];
      for (const role of professions)
        for (const [index, economy] of settings.entries()) {
          const s = createGame({
              profession: role.id,
              opponents: 5,
              liquidityRisk,
              difficulty: tiers[index % 3],
              ...economy,
            }),
            human = s.players[0],
            initial = playerFinancials(s, human);
          expect(new Set(s.players.map((p) => p.profile)).size).toBe(4);
          for (const npc of s.players.slice(1)) {
            expect(npc.profession).toBe(role.id);
            expect(playerFinancials(s, npc)).toEqual(initial);
            expect(npc.debts).toEqual(human.debts);
            expect(npc.childCost).toBe(human.childCost);
            expect(npc.debts).not.toBe(human.debts);
            expect(npc.debts[0]).not.toBe(human.debts[0]);
          }
          const roundTrip = validateSave(JSON.parse(JSON.stringify(s)));
          expect(roundTrip.players).toEqual(s.players);
          expect(reduceGame(roundTrip, { type: "ROLL" })).toEqual(
            reduceGame(s, { type: "ROLL" }),
          );
        }
    },
  );
  it("keeps each player's loans separate after starting from the same financial sheet", () => {
    const s = createGame({ profession: "lawyer", opponents: 5 }),
      debt = s.players[0].debts[0],
      original = debt.principal;
    const repaid = reduceGame(s, {
      type: "REPAY",
      debtId: debt.id,
      amount: 100000,
    });
    expect(repaid.players[0].debts[0].principal).toBe(original - 100000);
    for (const npc of repaid.players.slice(1))
      expect(npc.debts[0].principal).toBe(original);
    expect(professions.find((p) => p.id === "lawyer")!.debts[0].principal).toBe(
      original,
    );
  });
  it("persists the role reveal without changing balances or future randomness", () => {
    const s = createGame({ roleDifficulty: "hard", seed: 47 });
    expect(validateSave(s).roleRevealed).toBe(false);
    const revealed = reduceGame(validateSave(s), { type: "REVEAL_ROLE" });
    expect(revealed.players).toEqual(s.players);
    expect(revealed.rng).toBe(s.rng);
    expect(revealed.decks).toEqual(s.decks);
    expect(validateSave(revealed).roleRevealed).toBe(true);
    expect(reduceGame(revealed, { type: "REVEAL_ROLE" })).toEqual(revealed);
  });
  it("can complete a simulated match with every role and the current risk rules", () => {
    for (const [index, role] of professions.entries()) {
      let s = createGame({
        profession: role.id,
        seed: 1000 + index,
        opponents: 1,
        roundLimit: 25,
        adaptedCards: index % 2 === 0,
      });
      let turns = 0;
      while (s.phase !== "finished" && turns++ < 1500) {
        s = reduceGame(s, chooseNpc(npcView(s)).action);
        s.notices = [];
      }
      expect(s.phase, role.name).toBe("finished");
      expect(s.winners.length, role.name).toBeGreaterThan(0);
      const resumed = validateSave(s);
      for (const p of resumed.players) {
        const f = playerFinancials(resumed, p);
        expect(Number.isSafeInteger(f.cash) && f.cash >= 0, role.name).toBe(
          true,
        );
        expect(f.flow).toBe(f.income - f.expenses);
        expect(f.netWorth).toBe(f.cash + f.assets - f.debt);
      }
    }
  }, 30000);
});

describe("optional adapted cards and saved games", () => {
  it("defaults to original decks and includes sourced cards only when enabled", () => {
    const original = createGame();
    const adapted = createGame({ adaptedCards: true });
    expect(original.config.adaptedCards).toBe(false);
    expect(Object.values(original.decks).map((d) => d.length)).toEqual([
      56, 18, 132, 24,
    ]);
    expect(Object.values(adapted.decks).map((d) => d.length)).toEqual([
      104, 33, 132, 39,
    ]);
    expect(
      Object.values(original.decks)
        .flat()
        .some((id) => id.startsWith("enc-")),
    ).toBe(false);
  });
  for (const adaptedCards of [false, true]) {
    it(`respects adaptedCards=${adaptedCards} when all four decks refill`, () => {
      for (const kind of ["small", "large", "market", "expense"] as const) {
        let s = createGame({
          adaptedCards,
          liquidityRisk: false,
          economicCycles: false,
        });
        s.decks[kind] = [];
        if (kind === "small" || kind === "large") {
          s.phase = "decision";
          s.decision = { kind: "opportunity", owner: 0, transferred: false };
          s = reduceGame(s, { type: "DRAW", tier: kind });
        } else {
          s.players[0].position = kind === "market" ? 1 : 3;
          s.rng = 1;
          s = reduceGame(s, { type: "ROLL" });
        }
        expect(s.decks[kind].length).toBeGreaterThan(0);
        expect(s.decks[kind].some((id) => id.startsWith("enc-"))).toBe(
          adaptedCards && kind !== "market",
        );
      }
    });
  }
  it("migrates older saves while preserving players, deck order and RNG", () => {
    const s = createGame({ adaptedCards: true, profession: "designer" });
    const legacy = JSON.parse(JSON.stringify(s));
    delete legacy.config.adaptedCards;
    delete legacy.config.roleDifficulty;
    delete legacy.roleRevealed;
    const loaded = validateSave(legacy);
    expect(loaded.config.adaptedCards).toBe(true);
    expect(loaded.config.roleDifficulty).toBe("standard");
    expect(loaded.roleRevealed).toBe(true);
    expect(loaded.players).toEqual(s.players);
    expect(loaded.decks).toEqual(s.decks);
    expect(loaded.rng).toBe(s.rng);
    expect(reduceGame(loaded, { type: "ROLL" })).toEqual(
      reduceGame({ ...s, roleRevealed: true }, { type: "ROLL" }),
    );
  });
  it("rejects invalid difficulty, card switch and reveal data", () => {
    const s = createGame();
    for (const config of [
      { roleDifficulty: "extreme" },
      { adaptedCards: "yes" },
    ])
      expect(() =>
        validateSave({ ...s, config: { ...s.config, ...config } }),
      ).toThrow();
    expect(() => validateSave({ ...s, roleRevealed: "yes" })).toThrow();
  });
});
