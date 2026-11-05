import { money, playerFinancials } from "./engine";
import { economicEvents } from "./economy";
import type { FinancialHistoryPoint, GameState } from "./types";
export interface CoachTip {
  id: string;
  tone: "strength" | "improve";
  title: string;
  evidence: string;
  suggestion: string;
}
export function playerHistory(
  game: GameState,
  id: string,
): FinancialHistoryPoint[] {
  return game.history
    .filter((h) => h.player === id)
    .sort((a, b) => a.id - b.id);
}
// A display-only view of the human's completed journey, independent of later NPC play.
export function personalReviewState(game: GameState): GameState {
  const human = game.players[0];
  return {
    ...game,
    players: [human],
    current: 0,
    round: human.elimination?.round ?? game.round,
    history: game.history.filter(
      (h) => h.player === human.id && h.kind !== "finish",
    ),
    winners: [],
    finishReason:
      human.elimination?.reason ?? "You have been eliminated from this match.",
  };
}
export function coaching(game: GameState, id = "p0"): CoachTip[] {
  const player = game.players.find((p) => p.id === id)!,
    history = playerHistory(game, id),
    start = history[0]?.values ?? playerFinancials(game, player),
    end = playerFinancials(game, player),
    tips: CoachTip[] = [];
  const transactions = history.filter((h) => h.kind === "transaction");
  const forced = transactions.filter((h) =>
    h.title.startsWith("Distress sale:"),
  );
  if (forced.length)
    tips.push({
      id: "liquidity",
      tone: "improve",
      title: "Protect your reserve before investing",
      evidence: `${forced.length} forced sale${forced.length === 1 ? "" : "s"} reduced your portfolio. The first was “${forced[0].title}” in round ${forced[0].round}.`,
      suggestion:
        "Budget for the 10% cash-to-debt reserve and the next principal installment before buying. Distress sales recover only half current equity and remove recurring income.",
    });
  const shocks = transactions.filter(
    (h) =>
      economicEvents.some((c) => c.id && c.name === h.title) &&
      (h.delta.expenses ?? 0) - (h.delta.passive ?? 0) > 0,
  );
  if (shocks.length) {
    const worst = shocks.reduce((a, b) =>
      (a.delta.expenses ?? 0) - (a.delta.passive ?? 0) >
      (b.delta.expenses ?? 0) - (b.delta.passive ?? 0)
        ? a
        : b,
    );
    tips.push({
      id: "cycle",
      tone: "improve",
      title: "Stress-test your income against economic shocks",
      evidence: `“${worst.title}” in round ${worst.round} reduced monthly cash flow by ${money((worst.delta.expenses ?? 0) - (worst.delta.passive ?? 0))}.`,
      suggestion:
        "Compare your cash flow at twice the financing payment or with weaker operating income. Hold a reserve for principal payments; a high asset valuation cannot pay a cash bill.",
    });
  }
  const principal = transactions
    .filter((h) => h.title === "Scheduled principal payment")
    .reduce((v, h) => v - Math.min(0, h.delta.debt ?? 0), 0);
  if (principal > 0)
    tips.push({
      id: "principal",
      tone: "strength",
      title: "Scheduled payments reduced your liabilities",
      evidence: `You retired ${money(principal)} of principal through scheduled installments.`,
      suggestion:
        "Include the next installment in your cash budget. Custom partial repayments can lower future recurring payments, but spending the emergency reserve can still trigger a liquidity crisis.",
    });
  const low = transactions.filter(
    (h) => h.values.cash < h.values.expenses && h.values.expenses > 0,
  );
  const repayments = transactions.filter((h) => h.title.startsWith("Repaid "));
  const freed = repayments.reduce(
    (n, h) =>
      n +
      Math.max(0, -(h.delta.expenses ?? 0)) +
      Math.max(0, h.delta.passive ?? 0),
    0,
  );
  const borrowed = transactions
    .filter((h) => h.title === "Bank loan")
    .reduce((n, h) => n + Math.max(0, h.delta.cash ?? 0), 0);
  const peak = history.reduce(
    (best, h) => (h.values.passive > best.values.passive ? h : best),
    history[0],
  );
  const sold = transactions.filter(
    (h) => h.title.startsWith("Sold ") && (h.delta.passive ?? 0) < 0,
  );
  const skipped = history.filter(
    (h) => h.opportunity?.affordable && h.opportunity.income > 0,
  );
  if (end.passive > start.passive)
    tips.push({
      id: "income",
      tone: "strength",
      title: "You built income beyond your paycheck",
      evidence: `Monthly passive income grew from ${money(start.passive)} to ${money(end.passive)}.`,
      suggestion:
        "Keep comparing an investment’s net monthly income with the cash and financing it needs.",
    });
  else if (!peak || peak.values.passive <= start.passive)
    tips.push({
      id: "income",
      tone: "improve",
      title: "Give recurring income a bigger role",
      evidence: `You finished with ${money(end.passive)} in monthly passive income against ${money(end.expenses)} in expenses.`,
      suggestion:
        "Look for a small positive-income investment you can afford while retaining an emergency reserve. Salary and cash alone do not meet the freedom goal.",
    });
  if (low.length) {
    const worst = low.reduce((a, b) => (a.values.cash < b.values.cash ? a : b));
    tips.push({
      id: "reserve",
      tone: "improve",
      title: "Leave a little more room for surprises",
      evidence: `After “${worst.title}” in round ${worst.round}, cash was ${money(worst.values.cash)} against ${money(worst.values.expenses)} in monthly expenses. This happened at ${low.length} transaction${low.length === 1 ? "" : "s"}.`,
      suggestion:
        "Try keeping at least one month of expenses in cash before another discretionary purchase. This is a game strategy, not a guarantee against every bill.",
    });
  }
  if (borrowed > 0)
    tips.push({
      id: "leverage",
      tone: "improve",
      title: "Check what your borrowing really earns",
      evidence: `You took ${money(borrowed)} in personal bank loans during the recorded game. At the base ${game.config.annualRate}% annual rate, each $1,000 costs ${money(Math.round((100000 * game.config.annualRate) / 1200))} per month before temporary economic effects.`,
      suggestion:
        "Before borrowing, compare the deal’s net income with new loan interest and stress-test an unexpected expense. Property financing is already included in the deal’s net cash flow.",
    });
  if (freed > 0)
    tips.push({
      id: "repayment",
      tone: "strength",
      title: "Paying down debt created breathing room",
      evidence: `Your recorded repayments reduced monthly bills or increased net investment income by a combined ${money(freed)}.`,
      suggestion:
        "Compare the monthly payment removed per dollar repaid with the income from your next investment, while keeping enough cash for emergencies.",
    });
  if (sold.length && peak && peak.values.passive > end.passive) {
    const last = sold[sold.length - 1];
    tips.push({
      id: "sales",
      tone: "improve",
      title: "Have a reinvestment plan when you sell income",
      evidence: `“${last.title}” in round ${last.round} removed ${money(-(last.delta.passive ?? 0))} per month. Passive income peaked at ${money(peak.values.passive)} and ended at ${money(end.passive)}.`,
      suggestion:
        "A profitable sale can still be useful. Decide how you will replace the lost recurring income before accepting a market offer.",
    });
  }
  if (skipped.length)
    tips.push({
      id: "offers",
      tone: "improve",
      title: "Revisit the cost of waiting",
      evidence: `You passed ${skipped.length} recorded offer${skipped.length === 1 ? "" : "s"} that you could cover in cash and that offered positive income.`,
      suggestion:
        "Passing can protect reserves. Next time, compare the cash left after the purchase with an emergency buffer, then weigh the income you would gain.",
    });
  if (
    player.stage === "rat" &&
    end.cash > end.expenses * 3 &&
    end.passive <= end.expenses
  )
    tips.push({
      id: "idle",
      tone: "improve",
      title: "Give surplus cash a job",
      evidence: `You ended with ${money(end.cash)}, more than three months of your ${money(end.expenses)} expenses, while still in the Rat Race.`,
      suggestion:
        "Keep a reserve, then consider whether part of the surplus could buy recurring income or eliminate an expensive debt payment.",
    });
  const categories = new Set(player.assets.map((a) => a.category));
  if (player.assets.length >= 3 && categories.size === 1)
    tips.push({
      id: "concentration",
      tone: "improve",
      title: "Think about where your income comes from",
      evidence: `All ${player.assets.length} remaining investments belong to one asset category.`,
      suggestion:
        "When returns and cash reserves permit, compare another category. Market offers affect categories differently, though diversification does not remove risk.",
    });
  if (!tips.some((t) => t.tone === "improve"))
    tips.push({
      id: "next",
      tone: "improve",
      title: "Try the same start with a different first move",
      evidence: `This match used seed ${game.config.seed} and ${game.config.annualRate}% annual personal-loan interest.`,
      suggestion:
        "Replay the same setup and compare one change—an earlier investment or a debt payoff. Dice stay fair; your choices can change which later events you encounter.",
    });
  return tips;
}
