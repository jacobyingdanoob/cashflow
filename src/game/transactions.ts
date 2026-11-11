import type { Financials, GameState, Receipt } from "./types";

export interface TransactionEntry extends Receipt {
  round: number | null;
}

/** The receipt cache is bounded; the immutable financial history is complete. */
export function transactionHistory(
  game: GameState,
  playerId: string,
): TransactionEntry[] {
  const entries: TransactionEntry[] = game.history
    .filter(
      (point) => point.player === playerId && point.kind === "transaction",
    )
    .map((point) => ({
      id: point.id,
      player: point.player,
      round: point.round,
      title: point.title,
      note: point.note,
      before: Object.fromEntries(
        Object.entries(point.values).map(([key, value]) => [
          key,
          value - (point.delta[key as keyof Financials] ?? 0),
        ]),
      ) as unknown as Financials,
      after: point.values,
    }));
  // Saves from before history tracking may still contain older receipts.
  const historyStart =
    game.history.find(
      (point) => point.player === playerId && point.kind === "start",
    )?.id ?? Infinity;
  entries.push(
    ...game.receipts
      .filter(
        (receipt) => receipt.player === playerId && receipt.id < historyStart,
      )
      .map((receipt) => ({ ...receipt, round: null })),
  );
  return entries.sort((a, b) => b.id - a.id);
}
