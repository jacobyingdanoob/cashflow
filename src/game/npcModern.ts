import { money } from "./engine";
import { initialMarkets, opportunityType, purchaseQuote } from "./market";
import { personalities } from "./personalities";
import { debtCapacity } from "./lending";
import type { GameAction, NpcDecisionView } from "./types";

export function chooseModernNpc(v: NpcDecisionView): {
  action: GameAction;
  reason: string;
} {
  const p = v.player,
    f = v.financials,
    policy = personalities[p.profile],
    ratio = Math.max(policy.debtRatio, v.config.liquidityRisk ? 0.1 : 0),
    months = policy.months * (v.config.difficulty === "hard" ? 1.1 : 1),
    reserve =
      Math.ceil(f.debt * ratio) +
      Math.round(f.expenses * months) +
      v.principalDue,
    spare = Math.max(0, p.cash - reserve),
    mistake =
      (p.decisionCount * 37 +
        Math.floor(p.cash / 100) +
        p.name.charCodeAt(0) * 13) %
        100 <
      (v.config.difficulty === "easy"
        ? 20
        : v.config.difficulty === "standard"
          ? 6
          : 1);
  if (v.decision?.kind === "discount") {
    const choice = chooseModernNpc({
      ...v,
      decision: {
        kind: "opportunity",
        owner: 0,
        transferred: false,
        card: v.decision.card,
      },
    });
    if (choice.action.type === "BUY")
      return {
        action: {
          ...choice.action,
          type: "BARGAIN_BUY",
          card: v.decision.card,
        },
        reason: `Shared discount offer below 50%. ${choice.reason}`,
      };
    if (choice.action.type === "BORROW" && v.canBorrow !== false)
      return {
        ...choice,
        reason: `Financing a discount-market purchase. ${choice.reason}`,
      };
    return {
      action: { type: "PASS" },
      reason:
        choice.action.type === "BORROW"
          ? "I cannot borrow during another player's shared offer; keeping my reserve."
          : choice.reason,
    };
  }
  if (v.phase === "end") {
    const needsCash = p.cash < reserve;
    const sale = p.assets
      .filter((a) => !a.listing)
      .find((a) => {
        const q = v.voluntarySales?.[a.id];
        if (!q || q.net <= 0 || p.cash + q.net < 0) return false;
        const income = v.assetIncomes?.[a.id] ?? a.income;
        if (a.category === "stock")
          return (
            (needsCash && (q.taxableProfit > 0 || f.flow < 0)) ||
            (p.profile === "income" &&
              !mistake &&
              q.taxableProfit > a.cost * 0.25)
          );
        return income < 0 && !mistake;
      });
    if (sale)
      return {
        action: { type: "SELL_ANYTIME", playerId: p.id, assetId: sale.id },
        reason:
          sale.category === "stock"
            ? `${policy.name}: selling ${sale.name} now for ${money(v.voluntarySales![sale.id].net)} after tax, ${needsCash ? "to restore my cash buffer" : "to realize a substantial capital gain"}.`
            : `${policy.name}: listing loss-making ${sale.name}; accepting the quick-sale discount and a 1–3-round wait to remove its negative cash flow. This does not cover an immediate bill.`,
      };
    const mortgage =
      p.profile === "diverse"
        ? p.assets
            .filter((a) => a.mortgage > 0)
            .sort(
              (a, b) => b.financing / b.mortgage - a.financing / a.mortgage,
            )[0]
        : undefined;
    const debt = p.debts
      .filter((d) => d.principal > 0)
      .sort(
        (a, b) =>
          (b.monthlyRateBps !== undefined
            ? b.monthlyRateBps / 10000
            : b.kind === "bank"
              ? v.config.annualRate / 1200
              : b.payment / b.principal) -
          (a.monthlyRateBps !== undefined
            ? a.monthlyRateBps / 10000
            : a.kind === "bank"
              ? v.config.annualRate / 1200
              : a.payment / a.principal),
      )[0];
    const repay = mortgage
      ? { id: mortgage.id, principal: mortgage.mortgage, name: mortgage.name }
      : debt;
    if (
      repay &&
      spare >= 25000 &&
      !mistake &&
      (p.profile === "cautious" || p.profile === "diverse" || f.flow < 0)
    ) {
      const amount = Math.min(repay.principal, spare);
      return {
        action: { type: "REPAY", debtId: repay.id, amount },
        reason: `Repaying ${money(amount)} of ${repay.name} while keeping my ${money(reserve)} cash target: ${Math.round(ratio * 100)}% of debt, ${months.toFixed(1)} months of expenses and any chosen principal payment.`,
      };
    }
    return {
      action: { type: "END" },
      reason: `${policy.name}: keeping ${money(p.cash)} cash against a ${money(reserve)} target; ${p.profile === "bold" ? "saving borrowing capacity for expansion" : p.profile === "income" ? "waiting for stock opportunities" : "preserving reserves"}.`,
    };
  }
  if (v.decision?.kind === "market") {
    const target = v.eligibleAssets.find((a) => {
      const q = v.sales?.[a.id];
      if (!q || p.cash + q.net < 0) return false;
      if (p.profile === "income")
        return (
          a.category === "stock" &&
          (q.taxableProfit > a.cost * 0.1 ||
            (mistake && q.gross < a.cost * 0.7 && p.cash < reserve))
        );
      if (p.profile === "cautious") return q.taxableProfit > 0 && q.net > 0;
      if (p.profile === "bold")
        return (
          q.taxableProfit > a.cost * 0.05 ||
          ((p.cash < reserve || f.flow < 0) && q.net > 0)
        );
      return (
        (a.category === "stock" &&
          q.taxableProfit > 0 &&
          (p.assets.some((b) => b.mortgage > 0) || q.gross > a.cost * 1.25)) ||
        (q.taxableProfit > a.cost * 0.35 && p.cash < reserve)
      );
    });
    if (target) {
      const q = v.sales![target.id];
      return {
        action: { type: "SELL", assetId: target.id },
        reason: `${policy.name}: ${target.name} returns ${money(q.net)} after ${money(q.fee)} fees, ${money(q.penalty)} early-payoff costs and ${money(q.tax)} tax. ${p.profile === "diverse" ? "Profitable stock proceeds can reduce investment debt." : p.profile === "bold" ? "I can recycle this cash into another acquisition." : p.profile === "income" ? "Realizing the price gain matters more to me than the dividend." : "I will keep the proceeds for safe assets."}`,
      };
    }
    return {
      action: { type: "PASS" },
      reason: `${policy.name}: holding at this price; ${p.profile === "income" ? "I usually wait through declines rather than realize stock losses" : "net proceeds do not justify losing the holding's future income"}.`,
    };
  }
  if (!v.deal) {
    const large =
      p.profile !== "income" &&
      (p.profile === "bold" ? spare > 300000 : spare > 1000000);
    return {
      action: { type: "DRAW", tier: large ? "large" : "small" },
      reason: `${policy.name}: ${large ? "looking for a larger cash-flow opportunity" : "looking among stocks and smaller businesses"}, with ${money(spare)} above my cash target.`,
    };
  }
  const c = v.deal,
    type = opportunityType(c),
    outright =
      (p.profile === "income" ||
        (p.profile === "diverse" && spare > c.cost * 1.5)) &&
      type !== 3;
  if (p.profile === "cautious" && type === 1)
    return {
      action: { type: "PASS" },
      reason: `Conservative saver: this Type 1 asset adds ${money(c.mortgage)} debt. I never buy financed assets, even with attractive income.`,
    };
  if (p.profile === "income" && type !== 3 && (p.stockGains ?? 0) < 2000000)
    return {
      action: { type: "PASS" },
      reason: `Speculator: I prefer Type 3 stocks until realized stock gains reach $20,000; my recorded gains are ${money(p.stockGains ?? 0)}.`,
    };
  const shareFraction =
      p.profile === "income"
        ? 0.9
        : p.profile === "cautious" || p.profile === "bold"
          ? 0.15
          : 0.4,
    shares =
      type === 3
        ? Math.min(
            100000,
            Math.max(1, Math.floor((spare * shareFraction) / c.down)),
          )
        : 1,
    q = purchaseQuote(
      { marketState: initialMarkets() },
      c,
      shares,
      outright,
      p,
    ),
    income = q.deal.income * shares,
    afterReserve =
      reserve +
      Math.ceil(q.mortgage * ratio) +
      Math.round((q.mortgage * v.config.principalRate) / 100),
    yieldRate = (income * 12) / Math.max(1, q.cash),
    priceIndex = c.referenceCost ? c.cost / c.referenceCost : 1,
    stockFits =
      p.profile === "income"
        ? priceIndex <= (mistake ? 1.5 : 1.15)
        : p.profile === "cautious"
          ? priceIndex <= 1 && c.unitPrice <= 2500
          : p.profile === "diverse"
            ? priceIndex <= 1.1
            : priceIndex <= 0.95,
    fits =
      type === 3
        ? stockFits
        : p.profile === "bold"
          ? true
          : income > 0 &&
            (p.profile === "income" ||
              yieldRate >= (p.profile === "cautious" ? 0.08 : 0.1));
  const current = v.lending ?? {
    service: 0,
    income: f.income,
    bankRate: 0.02,
    purchaseRate: 0.01,
  };
  const mortgageCapacity = debtCapacity(
    current.service + q.deal.financing,
    current.income + income,
    q.mortgage > 0,
  );
  if (!mortgageCapacity.allowed)
    return {
      action: { type: "PASS" },
      reason: `${policy.name}: the mortgage would put debt service at ${(mortgageCapacity.ratio * 100).toFixed(1)}% of income after operating costs and mortgage financing, above the 55% lending limit. Starting role debt is excluded.`,
    };
  if (!fits || (mistake && p.profile !== "bold"))
    return {
      action: { type: "PASS" },
      reason: `${policy.name}: Type ${type} at ${Math.round(priceIndex * 100)}% of baseline with ${money(income)} net monthly income does not fit my current price and risk preference.`,
    };
  if (p.cash - q.cash >= afterReserve)
    return {
      action: { type: "BUY", shares, outright },
      reason: `${policy.name}: buying Type ${type}${outright ? " outright without a mortgage" : q.mortgage ? ` with ${Math.round(q.downRate * 100)}% down (financed acquisition #${q.tier})` : ""} for ${money(q.cash)} including ${money(q.fee)} acquisition fee. Cash left: ${money(p.cash - q.cash)}; target reserve: ${money(afterReserve)}. Net income: ${money(income)}/month.${q.mortgage ? ` DTI: ${(mortgageCapacity.ratio * 100).toFixed(1)}%, within 55%.` : ""}`,
    };
  const purchase = type === 1 && !outright,
    rate = purchase ? current.purchaseRate : current.bankRate,
    missing = q.cash + afterReserve - p.cash,
    denominator = 1 - ratio - v.config.principalRate / 100 - months * rate,
    loan =
      denominator > 0
        ? Math.ceil(missing / denominator / 100000) * 100000
        : Infinity,
    interest = Math.round(loan * rate),
    capacity = debtCapacity(
      current.service + q.deal.financing + interest,
      current.income + income,
    ),
    // Ordinary loans are checked before the future purchase contributes income.
    bridgeAllowed =
      purchase ||
      debtCapacity(current.service + interest, current.income).allowed;
  if (
    !p.bankrupt &&
    (purchase || v.canBorrow !== false) &&
    capacity.allowed &&
    bridgeAllowed &&
    type !== 3 &&
    (p.profile === "bold" ||
      (p.profile === "diverse" &&
        income > interest &&
        f.flow + income - interest > 0)) &&
    loan > 0 &&
    loan <= 100000000
  )
    return {
      action: purchase
        ? { type: "BUY", shares, outright, loan }
        : { type: "BORROW", amount: loan },
      reason: `${policy.name}: borrowing ${money(loan)} at ${rate * 100}% monthly for this Type ${type} purchase and its reserve.${purchase ? ` Down payment: ${Math.round(q.downRate * 100)}%, acquisition #${q.tier}.` : ""} Interest costs ${money(interest)}/month against ${money(income)} deal income; net after that loan: ${money(income - interest)}/month. DTI: ${(capacity.ratio * 100).toFixed(1)}%, within 55%.${income <= interest ? " This loan consumes all the deal income; I accept that expansion risk." : ""}`,
    };
  return {
    action: { type: "PASS" },
    reason: `${policy.name}: the ${money(q.cash)} purchase would breach my ${money(afterReserve)} reserve target.${!capacity.allowed || !bridgeAllowed ? " Additional borrowing would exceed the 55% debt-to-income limit." : p.profile === "cautious" || p.profile === "income" ? " I will not borrow for this purchase." : " Extra financing is too costly or too large."}`,
  };
}
