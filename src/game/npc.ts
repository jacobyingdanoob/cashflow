import { deals, dollars, marketById } from "./content";
import { chooseModernNpc } from "./npcModern";
import { voluntarySaleQuote } from "./sales";
import { lendingSnapshot, debtCapacity } from "./lending";
import { type1PurchaseCount } from "./market";
import {
  actingPlayer,
  assetFromDeal,
  dreamPrice,
  eligibleAssets,
  money,
  playerFinancials,
  reduceGame,
  marketSalePrice,
  marketSaleQuote,
} from "./engine";
import {
  assetIncome,
  assetValue,
  distressValue,
  effectiveDeal,
  factor,
  installment,
  requiredReserve,
} from "./economy";
import type { GameAction, GameState, NpcDecisionView } from "./types";
export function npcView(s: GameState): NpcDecisionView {
  const p = actingPlayer(s),
    d = s.decision;
  const original =
    d?.kind === "opportunity" || d?.kind === "discount"
      ? deals.find((c) => c.id === d.card)
      : undefined;
  const offered = original ? effectiveDeal(s, original) : undefined;
  return {
    lending: lendingSnapshot(s, p),
    voluntarySales: Object.fromEntries(
      p.assets.map((a) => [a.id, voluntarySaleQuote(s, a)]),
    ),
    assetIncomes: Object.fromEntries(
      p.assets.map((a) => [a.id, assetIncome(s, a)]),
    ),
    canBorrow: p.id === s.players[s.current].id && !p.bankrupt,
    modern: !!s.marketState,
    round: s.round,
    sales: s.marketState
      ? Object.fromEntries(p.assets.map((a) => [a.id, marketSaleQuote(s, a)]))
      : undefined,
    liquidityReserve: s.config.liquidityRisk ? requiredReserve(p) : 0,
    principalDue: installment(p, s.config.principalRate),
    distressValues: Object.fromEntries(
      p.assets.map((a) => [a.id, distressValue(s, a)]),
    ),
    player: { ...structuredClone(p), type1Purchases: type1PurchaseCount(s, p) },
    financials: playerFinancials(s, p),
    phase: s.phase,
    decision: structuredClone(d),
    deal:
      d?.kind === "opportunity" || d?.kind === "discount"
        ? offered
          ? {
              ...offered,
              income: assetIncome(s, assetFromDeal(offered, "preview")),
            }
          : undefined
        : undefined,
    market:
      d?.kind === "market"
        ? (() => {
            const card = marketById(d.card)!;
            return {
              ...card,
              ...(card.sharePrice !== undefined
                ? {
                    sharePrice: Math.round(
                      card.sharePrice * factor(s, "values", "stock"),
                    ),
                  }
                : {}),
            };
          })()
        : undefined,
    dreamPrice: d?.kind === "dream" ? dreamPrice(s, d.id) : undefined,
    eligibleAssets:
      d?.kind === "market"
        ? structuredClone(eligibleAssets(s, p, d.card)).map((a) => ({
            ...a,
            cost: s.marketState ? a.cost : assetValue(s, a),
            referenceValue: assetValue(s, a),
            income: assetIncome(s, a),
          }))
        : [],
    opponents: s.players.map((p) => ({
      id: p.id,
      cash: p.cash,
      human: p.human,
    })),
    config: {
      annualRate: s.config.annualRate * factor(s, "loanPayments"),
      liquidityRisk: s.config.liquidityRisk,
      principalRate: s.config.principalRate,
      difficulty: s.config.difficulty,
      incomeGoal: s.config.incomeGoal,
    },
  };
}
export function chooseNpc(v: NpcDecisionView): {
  action: GameAction;
  reason: string;
} {
  if (v.player.eliminated)
    return { action: { type: "END" }, reason: "My game is over." };
  if (
    v.decision?.kind === "liquidity" ||
    (v.decision?.kind === "insolvency" && v.player.cash < v.decision.amount)
  ) {
    const stock = v.player.assets.find(
      (a) => a.category === "stock" && (v.voluntarySales?.[a.id]?.net ?? 0) > 0,
    );
    if (stock)
      return {
        action: {
          type: "SELL_ANYTIME",
          playerId: v.player.id,
          assetId: stock.id,
        },
        reason: `Selling liquid shares at the current price to cover the immediate cash shortfall before considering a distress sale.`,
      };
  }
  if (
    v.modern &&
    (v.phase === "end" ||
      v.decision?.kind === "opportunity" ||
      v.decision?.kind === "discount" ||
      v.decision?.kind === "market")
  )
    return chooseModernNpc(v);
  const { player: p, financials: f, decision: d, config } = v;
  const reserveMonths =
    { cautious: 2, income: 0.8, bold: 0.25, diverse: 1.2 }[p.profile] *
    (config.difficulty === "hard"
      ? 1.15
      : config.difficulty === "easy"
        ? 0.75
        : 1);
  const reserve = Math.max(
    dollars(300),
    f.expenses * reserveMonths,
    v.liquidityReserve +
      v.principalDue +
      (config.liquidityRisk ? f.expenses * reserveMonths : 0),
  );
  const mistake =
    (p.decisionCount * 37 +
      p.name.charCodeAt(0) * 13 +
      Math.floor(p.cash / 100)) %
      100 <
    (config.difficulty === "easy"
      ? 24
      : config.difficulty === "standard"
        ? 7
        : 1);
  if (v.phase === "roll")
    return {
      action: { type: "ROLL" },
      reason: p.skip
        ? "Taking time to recover before investing again."
        : "Let’s see what the city has in store.",
    };
  if (v.phase === "end") {
    if (p.eliminated)
      return { action: { type: "END" }, reason: "My game is over." };
    const available = Math.floor(p.cash - reserve);
    const debt = [...p.debts]
      .sort(
        (a, b) =>
          (b.kind === "bank"
            ? config.annualRate / 1200
            : b.payment / b.principal) -
          (a.kind === "bank"
            ? config.annualRate / 1200
            : a.payment / a.principal),
      )
      .find(
        (d) =>
          Math.min(d.principal, available) >=
          Math.min(d.principal, dollars(250)),
      );
    if (debt && !mistake) {
      const amount = Math.min(debt.principal, available);
      return {
        action: { type: "REPAY", debtId: debt.id, amount },
        reason: `Repaying ${money(amount)} of ${debt.name.toLowerCase()} proportionally lowers its payment while preserving my reserve${config.principalRate ? " and chosen principal autopay" : ""}.`,
      };
    }
    return {
      action: { type: "END" },
      reason: `Keeping cash for the required reserve${config.principalRate ? ", chosen principal autopay," : ""} and future opportunities.`,
    };
  }
  if (d?.kind === "liquidity") {
    const asset = [...p.assets].sort(
      (a, b) =>
        ((v.distressValues[b.id] ?? 0) + b.mortgage / 10) /
          Math.max(1, b.income) -
        ((v.distressValues[a.id] ?? 0) + a.mortgage / 10) /
          Math.max(1, a.income),
    )[0];
    return asset
      ? {
          action: { type: "LIQUIDATE", assetId: asset.id },
          reason:
            "A forced sale raises cash and removes financing to restore the 10% reserve.",
        }
      : {
          action: { type: "BANKRUPT" },
          reason:
            "There are no investments left to sell. The liquidity crisis requires bankruptcy recovery.",
        };
  }
  if (d?.kind === "insolvency") {
    if (p.cash >= d.amount)
      return {
        action: { type: "PASS" },
        reason: "The payment is covered now.",
      };
    const loan = Math.ceil((d.amount - p.cash) / dollars(1000)) * dollars(1000);
    if (
      !p.bankrupt &&
      f.flow - Math.round(loan * (v.modern ? 0.02 : config.annualRate / 1200)) >
        0 &&
      (!v.modern ||
        (v.lending &&
          debtCapacity(
            v.lending.service + Math.round(loan * v.lending.bankRate),
            v.lending.income,
          ).allowed))
    )
      return {
        action: { type: "BORROW", amount: loan },
        reason:
          "A small bridge loan covers the bill without making monthly cash flow negative.",
      };
    if (p.assets.length)
      return {
        action: {
          type: "LIQUIDATE",
          assetId: [...p.assets].sort(
            (a, b) =>
              a.income / Math.max(1, a.distress) -
              b.income / Math.max(1, b.distress),
          )[0].id,
        },
        reason: "Selling a weaker asset to raise emergency cash.",
      };
    return {
      action: { type: "BANKRUPT" },
      reason:
        "Further borrowing is unsustainable. Time for bankruptcy recovery.",
    };
  }
  if (d?.kind === "charity") {
    const amount = Math.round(f.income / 10),
      accept = p.cash - amount >= reserve && !mistake;
    return {
      action: { type: "CHARITY", accept },
      reason: accept
        ? "I can afford to give and reach opportunities faster."
        : "I need to keep a cash buffer this time.",
    };
  }
  if (d?.kind === "dream")
    return {
      action:
        p.cash >= (v.dreamPrice ?? Infinity)
          ? { type: "BUY" }
          : { type: "PASS" },
      reason:
        p.cash >= (v.dreamPrice ?? Infinity)
          ? "This is what I have been building toward."
          : "My dream will have to wait until I have enough cash.",
    };
  if (d?.kind === "market") {
    if (v.market?.effect !== "offer")
      return {
        action: { type: "PASS" },
        reason: "Recording the shareholder event.",
      };
    const target = v.eligibleAssets.find((a) => {
      const proceeds = marketSalePrice(a, v.market!),
        ratio = (proceeds + a.mortgage) / Math.max(1, a.cost);
      return (
        p.cash + proceeds >= 0 &&
        (ratio >=
          (p.profile === "income" ? 1.4 : p.profile === "bold" ? 1.05 : 1.2) ||
          (p.cash < reserve && ratio >= 1))
      );
    });
    return target
      ? {
          action: { type: "SELL", assetId: target.id },
          reason: `${money(marketSalePrice(target, v.market))} after financing makes this sale worthwhile.`,
        }
      : {
          action: { type: "PASS" },
          reason: "The offer is worth less to me than keeping the income.",
        };
  }
  if (d?.kind === "opportunity") {
    if (!v.deal)
      return {
        action: {
          type: "DRAW",
          tier: p.cash > reserve + dollars(8500) ? "large" : "small",
        },
        reason:
          p.cash > reserve + dollars(8500)
            ? "I have enough reserves to consider a larger deal."
            : "Starting with a smaller commitment.",
      };
    const c = v.deal,
      shares =
        c.category === "stock"
          ? Math.max(
              1,
              Math.floor(
                (Math.max(0, p.cash - reserve) *
                  (p.profile === "diverse" ? 0.6 : 0.3)) /
                  c.down,
              ),
            )
          : 1;
    const down = c.down * shares,
      income = c.income * shares,
      purchaseReserve =
        reserve +
        (config.liquidityRisk ? (c.mortgage * shares) / 10 : 0) +
        (c.mortgage * shares * config.principalRate) / 100,
      missing = Math.max(0, down + purchaseReserve - p.cash),
      loan =
        Math.ceil(
          missing / ((config.liquidityRisk ? 0.9 : 1) * dollars(1000)),
        ) * dollars(1000);
    const interest = Math.round((loan * config.annualRate) / 1200),
      repeats = p.assets.filter((a) => a.category === c.category).length;
    const returnRate = (income * 12) / down,
      threshold =
        p.profile === "cautious" ? 0.2 : p.profile === "bold" ? 0.13 : 0.16;
    const good =
      !mistake &&
      returnRate >= threshold &&
      income > interest &&
      (p.profile !== "diverse" ||
        repeats < 3 ||
        p.assets.some((a) => a.category !== c.category));
    if (good && p.cash - down >= purchaseReserve)
      return {
        action: { type: "BUY", shares },
        reason: `Adding ${money(income)} per month while keeping ${money(p.cash - down)} in reserve.`,
      };
    if (
      good &&
      !p.bankrupt &&
      p.profile !== "cautious" &&
      c.category !== "stock" &&
      loan > 0 &&
      loan <= dollars(50000) &&
      f.flow + income - interest >
        f.expenses * (p.profile === "bold" ? 0.05 : 0.2)
    )
      return {
        action: { type: "BORROW", amount: loan },
        reason: `Expected monthly income of ${money(income)} exceeds ${money(interest)} in new loan interest.`,
      };
    return {
      action: { type: "PASS" },
      reason: mistake
        ? "I am going to wait for an opportunity I feel more confident about."
        : !good
          ? "The return or portfolio concentration does not fit my strategy."
          : `This would leave less than my ${money(reserve)} cash reserve.`,
    };
  }
  return { action: { type: "PASS" }, reason: "Waiting for a better fit." };
}
export function npcStep(s: GameState): GameState {
  const p = actingPlayer(s);
  if (p.human || s.pending || s.phase === "finished") return s;
  const { action, reason } = chooseNpc(npcView(s));
  const meaningful = !["ROLL", "DRAW", "END"].includes(action.type);
  // A resumed older save may begin in the middle of a turn. Capture its
  // remaining decisions before reducing, including a decision that wins.
  const context =
    s.turnContext ??
    (s.players[s.current].id === p.id
      ? {
          player: p.id,
          round: s.round,
          before: s.players.map((player) => ({
            player: player.id,
            values: playerFinancials(s, player),
          })),
          events: [],
          reasons: [],
          dice: [...s.dice],
        }
      : null);
  const prepared =
    context && meaningful
      ? {
          ...s,
          turnContext: { ...context, reasons: [...context.reasons, reason] },
        }
      : s;
  const next = reduceGame(prepared, action);
  next.log.unshift({
    id: ++next.sequence,
    round: s.round,
    player: p.name,
    text: `“${reason}”`,
    tone: "neutral",
  });
  next.log = next.log.slice(0, 150);
  return next;
}
