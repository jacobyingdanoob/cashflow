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
  it("draws a seeded role in the selected tier with unique NPC roles", () => {
    for (const roleDifficulty of tiers) {
      const seen = new Set<string>();
      for (let sample = 1; sample <= 100; sample++) {
        const seed = (sample * 2654435761) >>> 0;
        const options = { roleDifficulty, seed, opponents: 5 };
        const s = createGame(options);
        expect(s).toEqual(createGame(options));
        const role = professions.find((p) => p.id === s.players[0].profession)!;
        expect(role.difficulty).toBe(roleDifficulty);
        expect(new Set(s.players.map((p) => p.profession)).size).toBe(6);
        seen.add(role.id);
      }
      expect(seen.size).toBe(5);
    }
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
      56, 18, 24, 24,
    ]);
    expect(Object.values(adapted.decks).map((d) => d.length)).toEqual([
      104, 33, 36, 39,
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
          adaptedCards,
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
