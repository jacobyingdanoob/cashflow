import { money, preciseMoney, playerFinancials } from "./engine";
import { economicEvents, installment, reserveForDebt } from "./economy";
import type { FinancialHistoryPoint, Financials, GameState } from "./types";
export interface CoachTip {
  id: string;
  tone: "strength" | "improve";
  title: string;
  evidence: string;
  suggestion: string;
}
function reservePosition(
  f: Pick<Financials, "cash" | "debt">,
  enabled: boolean,
) {
  const reserve = enabled ? reserveForDebt(f.debt) : 0;
  return { reserve, buffer: f.cash - reserve };
}
export function coachingRisk(game: GameState, id = "p0") {
  const player = game.players.find((p) => p.id === id)!,
    f = playerFinancials(game, player),
    position = reservePosition(f, game.config.liquidityRisk),
    scheduledPrincipal = installment(player, game.config.principalRate),
    afterPrincipal = reservePosition(
      { cash: f.cash - scheduledPrincipal, debt: f.debt - scheduledPrincipal },
      game.config.liquidityRisk,
    );
  return {
    ...position,
    safetyBuffer: Math.max(100000, f.expenses),
    scheduledPrincipal,
    bufferAfterPrincipal: afterPrincipal.buffer,
  };
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
    risk = coachingRisk(game, id),
    tips: CoachTip[] = [];
  const transactions = history.filter((h) => h.kind === "transaction");
  if (game.marketState) {
    const declines = transactions.filter(
      (h) =>
        game.marketState!.history.some((t) => t.title === h.title) &&
        (h.delta.assets ?? 0) < 0,
    );
    if (declines.length) {
      const worst = declines.reduce((a, b) =>
        (a.delta.assets ?? 0) < (b.delta.assets ?? 0) ? a : b,
      );
      tips.push({
        id: "market-risk",
        tone: "improve",
        title: "Plan for persistent market losses",
        evidence: `“${worst.title}” in round ${worst.round} reduced portfolio value by ${preciseMoney(-(worst.delta.assets ?? 0))} and changed monthly passive income by ${preciseMoney(worst.delta.passive ?? 0)}. Debt principal did not fall with prices.`,
        suggestion:
          "Stress-test lower valuations and business or stock income before taking debt. A sale also needs cash for its fee, any early mortgage payoff penalty, and tax on positive profit. Keep the debt-linked cash reserve separate from the emergency fund; a market decline has no scheduled expiry.",
      });
    }
  }
  const bufferDescription = !game.config.liquidityRisk
    ? `${preciseMoney(end.cash)} was available for unexpected losses.`
    : risk.buffer < 0
      ? `Cash was ${preciseMoney(-risk.buffer)} below the required reserve.`
      : `${preciseMoney(risk.buffer)} remained above the required reserve for unexpected losses.`;
  const shockCash = end.cash - 100000,
    shockBuffer = risk.buffer - 100000,
    shockDescription = game.config.liquidityRisk
      ? shockBuffer < 0
        ? `A hypothetical $1,000 expense would leave ${preciseMoney(shockCash)} in cash, ${preciseMoney(-shockBuffer)} below the reserve required at a liquidity check. That shortfall can force a distress sale or bankruptcy recovery.`
        : `A hypothetical $1,000 expense would leave ${preciseMoney(shockBuffer)} above the required reserve.`
      : `The 10% reserve rule was off. A hypothetical $1,000 expense would leave ${preciseMoney(shockCash)} in cash.`;
  const principalDescription =
    risk.scheduledPrincipal > 0
      ? ` A hypothetical next scheduled principal payment of ${preciseMoney(risk.scheduledPrincipal)} would leave a buffer of ${preciseMoney(risk.bufferAfterPrincipal)}, after also reducing the debt-linked reserve.`
      : "";
  tips.push({
    id: "risk-buffer",
    tone:
      risk.bufferAfterPrincipal < risk.safetyBuffer ? "improve" : "strength",
    title:
      risk.bufferAfterPrincipal < risk.safetyBuffer
        ? game.config.liquidityRisk
          ? "Protect the cash above your debt reserve"
          : "Build cash for unexpected losses"
        : game.config.liquidityRisk
          ? "You kept cash above your required reserve"
          : "You kept an emergency cash buffer",
    evidence: `Ending cash: ${preciseMoney(end.cash)}. Total debt, including investment financing: ${preciseMoney(end.debt)}. Required reserve: ${preciseMoney(risk.reserve)}${game.config.liquidityRisk ? " (10% of debt)" : " (rule off)"}. ${bufferDescription} ${shockDescription}${principalDescription}`,
    suggestion: `Keep a shock buffer of at least ${preciseMoney(risk.safetyBuffer)} ${game.config.liquidityRisk ? "above the required reserve" : "in cash"} before discretionary spending. This is a coaching target based on one month of expenses or $1,000, whichever is larger. Recalculate cash and the reserve after both a purchase and any principal repayment; asset value and positive income cannot pay an immediate cash bill.`,
  });
  const forced = transactions.filter((h) =>
    h.title.startsWith("Distress sale:"),
  );
  if (forced.length)
    tips.push({
      id: "liquidity",
      tone: "improve",
      title: "Protect your reserve before investing",
      evidence: `${forced.length} forced sale${forced.length === 1 ? "" : "s"} reduced your portfolio. The first was “${forced[0].title}” in round ${forced[0].round}.`,
      suggestion: `Before buying, fund ${game.config.liquidityRisk ? "the 10% reserve on all debt, including the new investment's mortgage, plus a separate shock buffer" : "a cash buffer for unexpected bills"}.${game.config.principalRate > 0 ? " Include the opted-in principal installment in that budget." : ""} Distress sales recover only half current equity and remove recurring income.`,
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
        "Stress-test weaker operating income and twice the financing cost. Budget for a recurring deficit using only cash above the required reserve. A high asset valuation cannot pay a cash bill, and selling an asset may require an eligible market event.",
    });
  }
  const principalPayments = transactions.filter(
      (h) => h.title === "Scheduled principal payment",
    ),
    unsafePrincipal = principalPayments.find(
      (h) =>
        reservePosition(h.values, game.config.liquidityRisk).buffer <
        Math.max(100000, h.values.expenses),
    ),
    principal = principalPayments.reduce(
      (v, h) => v - Math.min(0, h.delta.debt ?? 0),
      0,
    );
  if (principal > 0)
    tips.push({
      id: "principal",
      tone: unsafePrincipal ? "improve" : "strength",
      title: unsafePrincipal
        ? "Scheduled principal also uses emergency cash"
        : "Scheduled payments reduced your liabilities",
      evidence: `You retired ${money(principal)} of principal through scheduled installments.${unsafePrincipal ? ` The payment in round ${unsafePrincipal.round} left a buffer of ${preciseMoney(reservePosition(unsafePrincipal.values, game.config.liquidityRisk).buffer)}, below the coaching target.` : ""}`,
      suggestion:
        "Include the next installment in your cash budget. Custom partial repayments can lower future recurring payments, but spending the emergency reserve can still trigger a liquidity crisis.",
    });
  const low = transactions.filter(
    (h) =>
      reservePosition(h.values, game.config.liquidityRisk).buffer <
      Math.max(100000, h.values.expenses),
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
        "Keep comparing net monthly income with the down payment, the extra reserve required by new financing, and the cash left for shocks. Income growth alone does not protect against a liquidity call.",
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
    const worst = low.reduce((a, b) =>
        reservePosition(a.values, game.config.liquidityRisk).buffer <
        reservePosition(b.values, game.config.liquidityRisk).buffer
          ? a
          : b,
      ),
      position = reservePosition(worst.values, game.config.liquidityRisk);
    tips.push({
      id: "reserve",
      tone: "improve",
      title: "Review the decisions that squeezed your buffer",
      evidence: `After “${worst.title}” in round ${worst.round}, cash was ${preciseMoney(worst.values.cash)} against total debt of ${preciseMoney(worst.values.debt)}. The required reserve was ${preciseMoney(position.reserve)}, leaving a buffer of ${preciseMoney(position.buffer)}. ${low.length} recorded transaction${low.length === 1 ? " left" : "s left"} less than the coaching target: the larger of one month's expenses and $1,000 above the reserve.`,
      suggestion:
        "Build emergency cash above the required reserve before another purchase or voluntary repayment. Compare the buffer before and after each decision; cash committed to the reserve cannot also serve as the emergency fund.",
    });
  }
  if (end.flow < 0)
    tips.push({
      id: "cash-flow-risk",
      tone: "improve",
      title: "Stop recurring losses from consuming your buffer",
      evidence: `Ending monthly cash flow was ${preciseMoney(end.flow)}. Each Payday at that cash flow would consume ${preciseMoney(-end.flow)} in cash, against ${preciseMoney(Math.max(0, risk.buffer))} above the required reserve.`,
      suggestion:
        "Address the recurring deficit before expanding. Compare more reliable net income and affordable debt reductions, while preserving cash for the reserve and unexpected expenses. Borrowing to cover repeated losses also adds debt service and reserve requirements.",
    });
  if (borrowed > 0 || end.debt > 0)
    tips.push({
      id: "leverage",
      tone: "improve",
      title: "Check what your borrowing really earns",
      evidence: `${borrowed > 0 ? `You took ${money(borrowed)} in personal bank loans during the recorded game. ` : ""}Ending total debt was ${preciseMoney(end.debt)}, including investment mortgages, with ${preciseMoney(risk.buffer)} in cash above the required reserve. ${game.marketState ? "Each $1,000 of new ordinary borrowing costs $20/month; Type 1 purchase borrowing costs $10/month. The 55% lending limit excludes starting role debt, but your reserve still covers all debt." : `At the base ${game.config.annualRate}% annual bank-loan rate, each $1,000 of personal borrowing costs ${money(Math.round((100000 * game.config.annualRate) / 1200))} per month before temporary economic effects.`}`,
      suggestion: `Before borrowing, compare the deal's net income with new personal-loan interest and stress-test an unexpected expense.${game.config.liquidityRisk ? " Each extra $10,000 of debt also raises the required cash reserve by $1,000. Budget the down payment and that higher reserve together." : " The reserve rule was off, but financing still creates recurring payments."} Property financing is already included in the deal's net cash flow; avoid counting it twice.`,
    });
  if (freed > 0) {
    const unsafeRepayment = repayments.find(
      (h) =>
        reservePosition(h.values, game.config.liquidityRisk).buffer <
        Math.max(100000, h.values.expenses),
    );
    tips.push({
      id: "repayment",
      tone: unsafeRepayment ? "improve" : "strength",
      title: unsafeRepayment
        ? "Debt repayments also need a cash buffer"
        : "Paying down debt reduced recurring costs",
      evidence: `Your recorded repayments reduced monthly bills or increased net investment income by a combined ${money(freed)}.${unsafeRepayment ? ` After “${unsafeRepayment.title}” in round ${unsafeRepayment.round}, the cash buffer was ${preciseMoney(reservePosition(unsafeRepayment.values, game.config.liquidityRisk).buffer)}, below the coaching target.` : ""}`,
      suggestion: `Compare the monthly payment saved with the cash buffer spent.${game.config.liquidityRisk ? " Repaying $1,000 of principal uses $1,000 cash but lowers a 10% required reserve by only $100, consuming $900 of shock buffer." : " A lower payment does not replace cash needed for an immediate bill."} Use a smaller optional repayment if a full payoff would leave too little emergency cash.`,
    });
  }
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
      title: "Check risk before acting on an affordable deal",
      evidence: `You passed ${skipped.length} recorded offer${skipped.length === 1 ? "" : "s"} that you could cover in cash and that offered positive income.`,
      suggestion:
        "Passing can protect reserves. Cash affordability alone does not prove a deal was safe: also fund the reserve on existing and new debt, then retain a separate shock buffer. Weigh the income only after those checks; the coach cannot infer that a skipped deal was a mistake.",
    });
  const surplus =
    risk.bufferAfterPrincipal - Math.max(100000, end.expenses * 3);
  if (
    player.stage === "rat" &&
    !player.eliminated &&
    surplus > 0 &&
    end.flow >= 0 &&
    end.passive <= end.expenses
  )
    tips.push({
      id: "idle",
      tone: "improve",
      title: "Consider only cash beyond your safety buffer",
      evidence: `Ending cash was ${preciseMoney(end.cash)}, with ${preciseMoney(risk.reserve)} required against debt. After budgeting for any opted-in principal installment and keeping three months of expenses or $1,000 above the reserve, ${preciseMoney(surplus)} remained while you were still in the Rat Race.`,
      suggestion:
        "Consider investing or repaying debt only from that remaining amount. Recalculate the reserve after new financing or repayment and retain the safety buffer; the full cash balance is not surplus.",
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
      evidence: `This match used seed ${game.config.seed} and ${game.marketState ? "2% monthly new bank loans and 1% monthly Type 1 purchase loans, with a 55% DTI limit" : `${game.config.annualRate}% annual personal-loan interest`}.`,
      suggestion:
        "Replay the same setup and compare one change—an earlier investment or a debt payoff. Dice stay fair; your choices can change which later events you encounter.",
    });
  const priorities = [
    "risk-buffer",
    "liquidity",
    "reserve",
    "cash-flow-risk",
    "cycle",
    "market-risk",
    "leverage",
    "repayment",
  ];
  return tips.sort(
    (a, b) =>
      Number(a.tone === "strength") - Number(b.tone === "strength") ||
      (priorities.indexOf(a.id) < 0
        ? priorities.length
        : priorities.indexOf(a.id)) -
        (priorities.indexOf(b.id) < 0
          ? priorities.length
          : priorities.indexOf(b.id)),
  );
}
