import { describe, expect, it } from "vitest";
import { createGame, reduceGame } from "./engine";
import { transactionHistory } from "./transactions";
import { validateSave } from "./storage";

describe("complete transaction records", () => {
  it("recovers every transaction beyond the recent receipt cache, with original round and totals", () => {
    let s = createGame({ seed: 123, liquidityRisk: false, tutorials: false });
    const startCash = s.players[0].cash;
    for (let i = 0; i < 75; i++) {
      s.round = 1 + Math.floor(i / 5);
      s = reduceGame(s, { type: "BORROW", amount: 100000 });
    }
    expect(s.receipts).toHaveLength(60);
    const entries = transactionHistory(s, "p0");
    expect(entries).toHaveLength(75);
    expect(entries.at(-1)).toMatchObject({
      round: 1,
      before: { cash: startCash },
      after: { cash: startCash + 100000 },
    });
    expect(entries[0]).toMatchObject({
      round: 15,
      after: { cash: startCash + 7500000 },
    });
    for (let i = 0; i < entries.length - 1; i++)
      expect(entries[i].before).toEqual(entries[i + 1].after);
    expect(
      transactionHistory(validateSave(JSON.parse(JSON.stringify(s))), "p0"),
    ).toEqual(entries);
    expect(transactionHistory(s, "p1")).toEqual([]);
  });

  it("shows only committed transactions and separates the players", () => {
    let s = createGame({ seed: 123, accounting: "manual", tutorials: false });
    s = reduceGame(s, { type: "BORROW", amount: 100000 });
    expect(transactionHistory(s, "p0")).toEqual([]);
    s = reduceGame(s, {
      type: "SUBMIT",
      values: Object.fromEntries(
        s.pending!.fields.map((key) => [
          key,
          String(s.pending!.receipt.after[key] / 100),
        ]),
      ),
    });
    expect(transactionHistory(s, "p0")).toHaveLength(1);
    s.current = 1;
    s = reduceGame(s, { type: "BORROW", amount: 200000 });
    expect(transactionHistory(s, "p0")).toHaveLength(1);
    expect(
      transactionHistory(s, "p1")[0].after.cash -
        transactionHistory(s, "p1")[0].before.cash,
    ).toBe(200000);
  });

  it("retains older receipts when migrating a save without the original financial timeline", () => {
    let s = createGame({ seed: 123, tutorials: false });
    s = reduceGame(s, { type: "BORROW", amount: 100000 });
    const old = { ...s, round: 5 } as Partial<typeof s>;
    delete old.history;
    delete old.historyStartRound;
    delete old.notices;
    delete old.turnContext;
    const restored = validateSave(old);
    expect(restored.historyStartRound).toBe(5);
    expect(transactionHistory(restored, "p0")).toHaveLength(1);
    expect(transactionHistory(restored, "p0")[0].round).toBeNull();
  });
});
