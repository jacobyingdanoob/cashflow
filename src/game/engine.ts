import {
  DEFAULT_CONFIG,
  deals,
  dollars,
  dreams,
  expenses,
  EARLY_OPPORTUNITY_ROUNDS,
  smallDealCopies,
  innerBoard,
  markets,
  fastTrackBoard,
  professions,
} from "./content";
import { marketById } from "./content";
import {
  initialMarkets,
  marketShocks,
  marketCopies,
  marketCategories,
  marketLabels,
  purchaseQuote,
  saleQuote,
  opportunityType,
  nextMarketIndex,
  type1PurchaseCount,
} from "./market";
import {
  addLoan,
  borrowingQuote,
  purchaseLending,
  validLoanAmount,
} from "./lending";
import { personalities } from "./personalities";
import { voluntarySaleQuote } from "./sales";
import { introduceSpace } from "./tutorials";
import {
  activeDepression,
  cycleRange,
  cycleMovement,
  initializeMarketDynamics,
  marketTrends,
  TREND_INTERVAL,
} from "./trends";
import {
  discountCandidates,
  canBargainBuy,
  BARGAIN_THRESHOLD,
} from "./bargains";
import type {
  AccountingField,
  Asset,
  Deal,
  Financials,
  GameAction,
  GameConfig,
  GameState,
  Player,
  Receipt,
  MarketCard,
  MarketTick,
  FinancialHistoryPoint,
} from "./types";
import {
  assetIncome,
  baseDebtPayment,
  assetValue,
  debtPayment,
  distressValue,
  economicEvents,
  effectiveDeal,
  factor,
  initializeEconomy,
  installment,
  isEconomicRound,
  payInstallment,
  repayPrincipal,
  requiredReserve,
} from "./economy";
export const money = (n: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: compact ? 1 : 0,
    ...(compact && Math.abs(n) >= 1000000
      ? { notation: "compact" as const }
      : {}),
  }).format(n / 100);
export const preciseMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(n / 100);
export function finances(
  p: Player,
  annualRate: number,
  state?: GameState,
): Financials {
  const passive = p.assets.reduce((v, a) => v + assetIncome(state, a), 0),
    income = p.salary + passive;
  const expenses =
    p.taxes +
    p.living +
    p.childCost * p.children +
    p.debts.reduce(
      (v, d) =>
        v +
        Math.round(
          baseDebtPayment(d, annualRate) * factor(state, "loanPayments"),
        ),
      0,
    );
  const debt =
    p.debts.reduce((v, d) => v + d.principal, 0) +
    p.assets.reduce((v, a) => v + a.mortgage, 0);
  const assets = p.assets.reduce((v, a) => v + assetValue(state, a), 0);
  return {
    cash: p.cash,
    salary: p.salary,
    passive,
    income,
    expenses,
    flow: income - expenses,
    debt,
    assets,
    netWorth: p.cash + assets - debt,
  };
}
export const playerFinancials = (s: GameState, p = s.players[s.current]) =>
  p.eliminated && p.elimination
    ? { ...p.elimination.financials }
    : finances(p, s.config.annualRate, s);
export const financialKeys: (keyof Financials)[] = [
  "cash",
  "salary",
  "passive",
  "income",
  "expenses",
  "flow",
  "debt",
  "assets",
  "netWorth",
];
function historyPoint(
  s: GameState,
  p: Player,
  title: string,
  note: string,
  kind: FinancialHistoryPoint["kind"],
  before: Financials,
  after: Financials,
): FinancialHistoryPoint {
  const delta: Partial<Financials> = {};
  financialKeys.forEach((k) => {
    if (after[k] !== before[k]) delta[k] = after[k] - before[k];
  });
  const point = {
    id: ++s.sequence,
    round: s.round,
    player: p.id,
    title,
    note,
    kind,
    values: { ...after },
    delta,
  };
  s.history.push(point);
  return point;
}
export function initializeReview(s: GameState) {
  s.personalReviewSeen ??= false;
  if (s.notices === undefined) s.notices = [];
  if (s.turnContext === undefined) s.turnContext = null;
  if (s.history === undefined) {
    s.history = [];
    s.historyStartRound = s.round;
    for (const p of s.players) {
      const f = playerFinancials(s, p);
      historyPoint(
        s,
        p,
        "History tracking started",
        "This saved match predates financial history. Earlier changes are unavailable.",
        "start",
        f,
        f,
      );
    }
  }
  for (const p of s.players) {
    if (!p.eliminated || p.elimination) continue;
    const last = s.history
      .filter((h) => h.player === p.id && h.kind !== "finish")
      .at(-1);
    p.elimination = {
      round: last?.round ?? s.round,
      reason:
        "Bankruptcy recovery could not restore affordable payments, the required reserve, and positive monthly cash flow.",
      financials: { ...(last?.values ?? finances(p, s.config.annualRate, s)) },
    };
  }
}
function notice(
  s: GameState,
  p: Player,
  title: string,
  description: string,
  receipt?: Receipt,
) {
  if (!p.human) return;
  s.notices.push({
    id: ++s.sequence,
    kind: "event",
    player: p.id,
    round: s.round,
    title,
    description,
    events: [],
    reasons: [],
    dice: [...s.dice],
    changes: receipt
      ? [{ player: p.id, before: receipt.before, after: receipt.after }]
      : [],
  });
  s.notices = s.notices.slice(-40);
}
function summarizeTurn(s: GameState, p: Player) {
  if (p.human) {
    s.turnContext = null;
    return;
  }
  const context = s.turnContext;
  s.notices.push({
    id: ++s.sequence,
    kind: "npc-turn",
    player: p.id,
    round: context?.round ?? s.round,
    title: `${p.name}’s turn, at a glance`,
    description:
      s.phase === "finished"
        ? "The final move is complete. Your game overview is ready."
        : "Here is what happened this turn. Play continues while this notification is visible.",
    events: context?.events ?? ["Finished the turn."],
    reasons: context?.reasons ?? [],
    dice: [...(context?.dice ?? s.dice)],
    changes: s.players.map((other) => ({
      player: other.id,
      before:
        context?.before.find((v) => v.player === other.id)?.values ??
        playerFinancials(s, other),
      after: playerFinancials(s, other),
    })),
  });
  s.turnContext = null;
}
export class RuleError extends Error {}
function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}
export function random(s: GameState) {
  let x = s.rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 4294967296;
}
function shuffle(s: GameState, ids: string[]) {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function log(
  s: GameState,
  text: string,
  tone: "neutral" | "positive" | "negative" = "neutral",
  p = s.players[s.current],
) {
  s.log.unshift({
    id: ++s.sequence,
    round: s.round,
    player: p.name,
    text,
    tone,
  });
  s.log = s.log.slice(0, 150);
  if (s.turnContext) s.turnContext.events.push(`${p.name}: ${text}`);
}
export function createGame(options: Partial<GameConfig> = {}): GameState {
  const config = { ...DEFAULT_CONFIG, ...options };
  requireRule(
    typeof config.liquidityRisk === "boolean" &&
      typeof config.economicCycles === "boolean" &&
      typeof config.adaptedCards === "boolean" &&
      typeof config.tutorials === "boolean" &&
      ["easy", "standard", "hard"].includes(config.roleDifficulty) &&
      [0, 0.5, 1, 2].includes(config.principalRate),
    "Choose supported risk and principal settings.",
  );
  requireRule(
    Number.isInteger(config.opponents) &&
      config.opponents >= 1 &&
      config.opponents <= 8,
    "Choose between one and eight opponents.",
  );
  requireRule(
    [0.5, 1, 2, 5].includes(config.startingCash) &&
      [0.75, 1, 1.25].includes(config.livingExpenses) &&
      [6, 12, 18, 24].includes(config.annualRate) &&
      [0.5, 1, 2].includes(config.dreamMultiplier),
    "Choose supported economy settings.",
  );
  requireRule(
    ["random", ...professions.map((p) => p.id)].includes(config.profession) &&
      dreams.some((d) => d.id === config.dream),
    "Choose a valid profession and dream.",
  );
  requireRule(
    [0, 25, 50, 100, 200].includes(config.roundLimit) &&
      [250000, 500000, 1000000, 2000000].includes(config.incomeGoal) &&
      ["easy", "standard", "hard"].includes(config.difficulty) &&
      ["auto", "manual"].includes(config.accounting) &&
      ["freedom", "full"].includes(config.victory) &&
      ["instant", "fast", "normal"].includes(config.speed),
    "Choose supported match settings.",
  );
  requireRule(
    Number.isSafeInteger(config.seed) &&
      config.seed > 0 &&
      config.seed <= 4294967295,
    "Seed must be an integer between 1 and 4,294,967,295.",
  );
  const s: GameState = {
    marketState: initialMarkets(),
    personalReviewSeen: false,
    smallDeckStage: "early",
    roleRevealed: false,
    economy: {
      version: 1,
      active: [],
      deck: [],
      lastRound: 1,
      principalPaid: {},
      warned: {},
    },
    version: 1,
    contentVersion: 1,
    config,
    rng: config.seed,
    players: [],
    current: 0,
    round: 1,
    phase: "roll",
    dice: [],
    decision: null,
    pending: null,
    effects: [],
    decks: { small: [], large: [], market: [], expense: [] },
    claimed: [],
    dreamVisits: {},
    log: [],
    receipts: [],
    sequence: 0,
    winners: [],
    finishReason: "",
    tutorialDone: false,
    tutorialSeen: [],
    tutorialQueue: [],
    history: [],
    historyStartRound: 1,
    notices: [],
    turnContext: null,
  };
  const colors = [
    "#24675b",
    "#d99b52",
    "#8b80ad",
    "#d77863",
    "#6295a4",
    "#839765",
    "#865c88",
    "#477986",
    "#aa633b",
  ];
  const profiles = ["cautious", "income", "bold", "diverse"] as const;
  const pool = shuffle(
    s,
    professions.map((p) => p.id),
  );
  const eligible = pool.filter(
    (id) =>
      professions.find((p) => p.id === id)!.difficulty ===
      config.roleDifficulty,
  );
  // A shuffled subset is uniformly random without another source of randomness.
  const humanRole =
    config.profession === "random" ? eligible[0] : config.profession;
  // Everyone shares the human's opening financial sheet. NPC personality and
  // decision difficulty affect choices, never starting income or liabilities.
  const pr = professions.find((p) => p.id === humanRole)!;
  for (let i = 0; i <= config.opponents; i++) {
    const availableDreams = dreams.filter(
      (d) => !s.players.some((p) => p.dream === d.id),
    );
    const p: Player = {
      id: `p${i}`,
      name: [
        "You",
        "Maya",
        "Oliver",
        "Sofia",
        "Theo",
        "Amara",
        "Leo",
        "Nina",
        "Ezra",
      ][i],
      human: i === 0,
      profile: profiles[(i + 3) % 4],
      profession: pr.id,
      salary: pr.salary,
      taxes: pr.taxes,
      living: Math.round(pr.living * config.livingExpenses),
      childCost: pr.childCost,
      children: 0,
      cash: 0,
      debts: structuredClone(pr.debts),
      assets: [],
      position: 0,
      stage: "rat",
      entryIncome: 0,
      dream:
        i === 0
          ? config.dream
          : availableDreams[Math.floor(random(s) * availableDreams.length)].id,
      dreamOwned: false,
      skip: 0,
      charity: 0,
      eliminated: false,
      debtRelief: false,
      bankrupt: false,
      color: colors[i],
      decisionCount: 0,
      stockGains: 0,
    };
    p.cash = Math.round(
      (pr.savings + finances(p, config.annualRate).flow) * config.startingCash,
    );
    if (config.liquidityRisk) p.cash += requiredReserve(p);
    s.players.push(p);
  }
  for (const kind of ["small", "large", "market", "expense"] as const)
    s.decks[kind] = shuffle(
      s,
      deckIds(s.config, kind, s.smallDeckStage, !!s.marketState),
    );
  log(s, "A fresh start. Your first opportunity is one roll away.");
  for (const p of s.players) {
    const f = playerFinancials(s, p);
    historyPoint(
      s,
      p,
      "Starting position",
      "Profession, savings, and starting expenses.",
      "start",
      f,
      f,
    );
  }
  return s;
}
function deckIds(
  config: GameConfig,
  kind: keyof GameState["decks"],
  stage: GameState["smallDeckStage"],
  modern = false,
) {
  if (kind === "small")
    return deals
      .filter((c) => c.tier === "small" && (config.adaptedCards || !c.source))
      .flatMap((c) =>
        Array<string>(smallDealCopies(c, stage === "early")).fill(c.id),
      );
  const cards =
    kind === "market"
      ? modern
        ? marketShocks
        : markets
      : kind === "expense"
        ? expenses
        : deals.filter((c) => c.tier === kind);
  return cards
    .filter((c) => config.adaptedCards || !c.source)
    .flatMap((c) =>
      Array<string>(
        kind === "market" && modern ? marketCopies(c as MarketCard) : 1,
      ).fill(c.id),
    );
}
function draw(s: GameState, kind: keyof GameState["decks"]) {
  if (kind === "small") {
    const stage = s.round <= EARLY_OPPORTUNITY_ROUNDS ? "early" : "normal";
    // A legacy save adopts the new opening mix on its next small draw. The
    // cutoff switch rebuilds the deck so leftover extra copies do not linger.
    if (s.smallDeckStage !== stage) {
      s.smallDeckStage = stage;
      s.decks.small = [];
    }
  }
  if (!s.decks[kind].length) {
    s.decks[kind] = shuffle(
      s,
      deckIds(s.config, kind, s.smallDeckStage, !!s.marketState),
    );
  }
  return s.decks[kind].pop()!;
}
function finish(s: GameState, ids: string[], reason: string) {
  s.winners = ids;
  s.finishReason = reason;
  s.phase = "finished";
  s.decision = null;
  s.effects = [];
  log(s, reason, "positive");
  for (const p of s.players) {
    const f = playerFinancials(s, p);
    const point = historyPoint(s, p, "Final position", reason, "finish", f, f);
    point.round = Math.min(s.round, s.config.roundLimit || s.round);
  }
}
function victory(s: GameState, p: Player) {
  if (s.phase === "finished" || p.eliminated) return;
  const f = playerFinancials(s, p);
  if (
    s.config.victory === "full" &&
    p.stage === "fast" &&
    (p.dreamOwned || f.passive >= p.entryIncome + s.config.incomeGoal)
  )
    finish(
      s,
      [p.id],
      p.dreamOwned
        ? `${p.name} purchased ${dreams.find((d) => d.id === p.dream)?.name.toLowerCase()}.`
        : `${p.name} added ${money(s.config.incomeGoal)} in monthly passive income.`,
    );
}
function commit(s: GameState, p: Player, receipt: Receipt) {
  if (p.eliminated && !p.elimination)
    p.elimination = {
      round: s.round,
      reason:
        "Bankruptcy recovery could not restore affordable payments, the required reserve, and positive monthly cash flow.",
      financials: { ...receipt.after },
    };
  s.players[s.players.findIndex((v) => v.id === p.id)] = p;
  s.receipts.unshift(receipt);
  s.receipts = s.receipts.slice(0, 60);
  historyPoint(
    s,
    p,
    receipt.title,
    receipt.note,
    "transaction",
    receipt.before,
    receipt.after,
  );
  log(
    s,
    `${receipt.title}${receipt.note ? ` · ${receipt.note}` : ""}`,
    receipt.after.cash >= receipt.before.cash ? "positive" : "neutral",
    p,
  );
  victory(s, p);
  warnLiquidity(s, p);
}
const fields: AccountingField[] = [
  "cash",
  "assets",
  "debt",
  "income",
  "expenses",
  "passive",
  "flow",
];
function transaction(
  s: GameState,
  p: Player,
  title: string,
  change: (next: Player) => void,
  note = "",
) {
  requireRule(!s.pending, "Complete your accounting first.");
  const next = structuredClone(p),
    before = playerFinancials(s, p);
  change(next);
  requireRule(
    Number.isSafeInteger(next.cash) && next.cash >= 0,
    "This transaction needs more cash.",
  );
  const after = playerFinancials(s, next),
    receipt: Receipt = {
      id: ++s.sequence,
      player: p.id,
      title,
      before,
      after,
      note,
    };
  const affected = fields.filter((k) => before[k] !== after[k]);
  if (p.human && s.config.accounting === "manual" && affected.length)
    s.pending = { next, receipt, fields: affected, errors: [], values: {} };
  else commit(s, next, receipt);
  notice(
    s,
    p,
    title,
    `${note}${s.pending ? " Record the changes in your worksheet in the decision panel." : " Your financial statement has been updated."}`.trim(),
    receipt,
  );
}
export function eligibleAssets(s: GameState, p: Player, cardId: string) {
  const c = marketById(cardId);
  return c ? p.assets.filter((a) => a.category === c.category) : [];
}
export const salePrice = (a: Asset, multiplier: number, state?: GameState) =>
  Math.round(assetValue(state, a) * multiplier) - a.mortgage;
export const marketSalePrice = (
  a: Asset,
  card: MarketCard,
  state?: GameState,
) =>
  state?.marketState
    ? marketSaleQuote(state, a).net
    : card.sharePrice !== undefined
      ? Math.round(card.sharePrice * factor(state, "values", "stock")) *
          a.shares -
        a.mortgage
      : salePrice(a, card.multiplier, state);
export function marketSaleQuote(s: GameState, a: Asset) {
  return saleQuote(s, a, assetValue(s, a));
}
export function dreamPrice(s: GameState, id: string) {
  return (
    Math.round(
      dreams.find((d) => d.id === id)!.cost * s.config.dreamMultiplier,
    ) *
    (1 + (s.dreamVisits[id]?.length ?? 0))
  );
}
function responder(s: GameState) {
  return s.decision?.kind === "market" || s.decision?.kind === "discount"
    ? s.decision.responder
    : s.current;
}
export function actingPlayer(s: GameState) {
  return s.players[responder(s)];
}
function charge(
  s: GameState,
  p: Player,
  amount: number,
  title: string,
  description = "",
) {
  if (p.cash < amount) {
    s.decision = { kind: "insolvency", amount, title };
    s.phase = "decision";
    log(s, `${title}: ${money(amount)} is due.`, "negative", p);
    notice(
      s,
      p,
      title,
      `${description} A payment of ${money(amount)} is due. You have ${money(p.cash)}. Use the decision panel to review borrowing and recovery options.`.trim(),
    );
  } else
    transaction(
      s,
      p,
      title,
      (n) => {
        n.cash -= amount;
      },
      description,
    );
}
function repriceMarket(s: GameState, card: MarketCard) {
  applyMarketChange(s, {
    category: card.category,
    card: card.id,
    title: card.name,
    player: s.players[s.current].id,
    source: "shock",
    changeBps: Math.round((card.multiplier - 1) * 10000),
  });
}
function applyMarketChange(
  s: GameState,
  event: Omit<MarketTick, "id" | "round" | "before" | "after">,
  quiet = false,
) {
  const market = s.marketState!,
    before = s.players.map((p) => playerFinancials(s, p)),
    previous = market.indices[event.category],
    proposed = nextMarketIndex(previous, 1 + event.changeBps! / 10000);
  let depression = activeDepression(s, event.category);
  const priorDepression = market.dynamics?.depressions?.[event.category];
  if (
    !depression &&
    proposed < 3500 &&
    (previous >= 3500 || !priorDepression)
  ) {
    depression = {
      start: s.round,
      expires: s.round + 5 + Math.floor(random(s) * 6),
    };
    market.dynamics!.depressions![event.category] = depression;
    notice(
      s,
      s.players[0],
      `${marketLabels[event.category]} depression`,
      `Prices stay below 35% through round ${depression.expires - 1}. Ordinary fluctuations continue; economic trend forces pause in this market. Market-space shocks remain capped below 35%. Discount purchases remain available.`,
    );
  }
  const next = depression ? Math.min(3499, proposed) : proposed;
  market.indices[event.category] = next;
  market.history.push({
    ...event,
    id: ++s.sequence,
    round: s.round,
    before: previous,
    after: next,
    ...(depression ? { depression: { ...depression } } : {}),
  });
  for (const [i, p] of s.players.entries()) {
    if (p.eliminated) continue;
    const after = playerFinancials(s, p),
      note = `${event.title}: ${(100 * (next / previous - 1)).toFixed(2)}% actual change. Market index ${(previous / 100).toFixed(2)}% → ${(next / 100).toFixed(2)}%.${event.cycleDrawBps !== undefined ? ` Cycle baseline ${(event.cycleDrawBps / 100).toFixed(2)}%, adjusted toward 100%; ordinary fluctuation ${(event.fluctuationBps! / 100).toFixed(2)}%.` : ""}${depression ? ` Depression cap: below 35% through round ${depression.expires - 1}.` : ""} Changes compound without a reset. Property rent is unchanged; business and stock operating income follow 25% of the index's move from 100%. Revaluation does not add or remove cash.`;
    if (
      before[i].assets !== after.assets ||
      before[i].passive !== after.passive
    ) {
      const receipt = {
        id: ++s.sequence,
        player: p.id,
        title: event.title,
        note,
        before: before[i],
        after,
      };
      s.receipts.unshift(receipt);
      historyPoint(s, p, event.title, note, "transaction", before[i], after);
      if (!quiet) notice(s, p, event.title, note, receipt);
    }
  }
  s.receipts = s.receipts.slice(0, 60);
}
function marketRound(s: GameState) {
  initializeMarketDynamics(s);
  const market = s.marketState!,
    dynamics = market.dynamics!;
  if (dynamics.lastRound >= s.round) return;
  dynamics.lastRound = s.round;
  dynamics.roundOpen = { ...market.indices };
  const before = s.players.map((p) => playerFinancials(s, p));
  if (dynamics.active && dynamics.active.expires <= s.round)
    dynamics.active = null;
  let drawn = false;
  if (s.config.economicCycles && s.round % TREND_INTERVAL === 0) {
    if (!dynamics.deck.length)
      dynamics.deck = shuffle(
        s,
        marketTrends.map((c) => c.id),
      );
    const drawnId = dynamics.deck.pop();
    const card = marketTrends.find((c) => c.id === drawnId)!;
    dynamics.active = {
      card: card.id,
      start: s.round,
      expires: s.round + card.duration,
    };
    drawn = true;
  }
  const trend = dynamics.active
    ? marketTrends.find((c) => c.id === dynamics.active!.card)!
    : null;
  const movements: string[] = [];
  for (const category of marketCategories) {
    let fluctuation: number;
    if (category === "stock") {
      const pick = Math.floor(random(s) * 202);
      fluctuation = pick <= 100 ? -200 - pick : 200 + pick - 101;
    } else {
      const max = category === "property" ? 25 : 100;
      fluctuation = Math.floor(random(s) * (max * 2 + 1)) - max;
    }
    const range =
      trend && !activeDepression(s, category)
        ? cycleRange(trend, category)
        : undefined;
    const cycleDraw = range
      ? range[0] + Math.floor(random(s) * (range[1] - range[0] + 1))
      : undefined;
    const bps =
      cycleDraw === undefined
        ? fluctuation
        : cycleMovement(
            cycleDraw,
            category,
            market.indices[category],
            fluctuation,
          );
    const previous = market.indices[category];
    applyMarketChange(
      s,
      {
        category,
        card: cycleDraw === undefined ? `drift-${category}` : trend!.id,
        player: "",
        title:
          cycleDraw === undefined
            ? `${marketLabels[category]} · Round ${s.round} fluctuation`
            : `${trend!.name} · ${marketLabels[category]}`,
        source: cycleDraw === undefined ? "drift" : "trend",
        changeBps: bps,
        model: 2,
        fluctuationBps: fluctuation,
        ...(cycleDraw !== undefined
          ? { trendStart: dynamics.active!.start, cycleDrawBps: cycleDraw }
          : {}),
      },
      true,
    );
    const actual = (market.indices[category] / previous - 1) * 100;
    movements.push(
      `${marketLabels[category]} ${actual > 0 ? "+" : ""}${actual.toFixed(2)}%`,
    );
  }
  const changes = s.players
    .filter((p) => !p.eliminated)
    .map((p) => ({
      player: p.id,
      before: before[s.players.indexOf(p)],
      after: playerFinancials(s, p),
    }));
  if (
    drawn ||
    changes.some(
      (c) =>
        c.before.assets !== c.after.assets ||
        c.before.passive !== c.after.passive,
    )
  )
    s.notices.push({
      id: ++s.sequence,
      kind: drawn ? "cycle" : "event",
      player: s.players[0].id,
      round: s.round,
      title: drawn ? trend!.name : `Round ${s.round} markets`,
      description: `${movements.join(" · ")}.${trend ? ` Trend active through round ${dynamics.active!.expires - 1}; prices do not reset afterward.` : " Ordinary market fluctuations."}`,
      events: movements,
      reasons: [],
      dice: [],
      changes,
      ...(drawn ? { eventId: trend!.id, tone: trend!.tone } : {}),
    });
}
function startDiscountOffer(s: GameState, market: string) {
  const category = marketById(market)!.category,
    candidates = discountCandidates(s, category);
  const queue = s.players.flatMap((p, i) =>
    !p.eliminated && !p.bankrupt && !p.skip ? [i] : [],
  );
  if (!candidates.length || !queue.length) return false;
  const card = candidates[Math.floor(random(s) * candidates.length)];
  s.decision = {
    kind: "discount",
    card: card.id,
    market,
    responder: queue[0],
    remaining: queue.slice(1),
  };
  s.phase = "decision";
  log(
    s,
    `Discounted market offer: ${card.name}. Each eligible player may buy once or pass at the same current price.`,
  );
  if (queue.includes(0))
    notice(
      s,
      s.players[0],
      "Discounted market offer",
      `${card.name} is available at ${(s.marketState!.indices[category] / 100).toFixed(2)}% of its opening price. Everyone receives the same randomly selected asset and chooses independently whether to buy. Fees and financing still apply.`,
    );
  return true;
}
function advanceDiscount(s: GameState) {
  if (s.phase === "finished") return;
  const d = s.decision;
  requireRule(
    d?.kind === "discount",
    "There is no discount offer to complete.",
  );
  if (d.remaining.length)
    s.decision = {
      ...d,
      responder: d.remaining[0],
      remaining: d.remaining.slice(1),
    };
  else {
    s.decision = null;
    s.phase = "end";
  }
}
function completeDiscountPurchase(s: GameState) {
  if (s.pending) s.pending.completeDiscount = true;
  else advanceDiscount(s);
}
function marketResponse(s: GameState, card: string) {
  const queue = s.players
    .map((p, i) =>
      !p.eliminated &&
      (eligibleAssets(s, p, card).length ||
        (s.marketState &&
          s.marketState.indices[marketById(card)!.category] <
            BARGAIN_THRESHOLD))
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
  if (queue.length) {
    s.decision = {
      kind: "market",
      card,
      responder: queue[0],
      remaining: queue.slice(1),
    };
    s.phase = "decision";
    if (!s.players[s.current].human && queue.includes(0)) {
      const event = marketById(card)!;
      notice(
        s,
        s.players[0],
        event.name,
        `${s.players[s.current].name} drew this market event. ${event.description} ${eligibleAssets(s, s.players[0], card).length ? "You hold an eligible investment." : "This market is below 50%; a shared discounted offer follows the sale responses."} Use the decision panel to review your response.`,
      );
    }
  } else log(s, "Market update: nobody holds an eligible asset.");
}
function land(s: GameState) {
  const p = s.players[s.current],
    space = (p.stage === "rat" ? innerBoard : fastTrackBoard(s.players))[
      p.position
    ];
  log(s, `Landed on ${space.label.toLowerCase()}.`);
  introduceSpace(s, p, space.kind);
  switch (space.kind) {
    case "payday":
      break;
    case "opportunity":
      s.decision = {
        kind: "opportunity",
        owner: s.current,
        transferred: false,
      };
      s.phase = "decision";
      notice(
        s,
        p,
        "Opportunity knocks",
        "Choose the small or large opportunity deck in the decision panel. You can review the deal before committing.",
      );
      break;
    case "business":
      if (s.claimed.includes(space.content!)) {
        log(s, "This business already has an owner.");
        notice(
          s,
          p,
          space.label,
          "This business already has an owner. No purchase is available and your finances are unchanged.",
        );
        break;
      }
      s.decision = {
        kind: "opportunity",
        tier: undefined,
        card: space.content!,
        owner: s.current,
        transferred: false,
      };
      s.phase = "decision";
      notice(
        s,
        p,
        space.label,
        "A Fast Track business is available. Use the decision panel to review its price, financing, and income.",
      );
      break;
    case "market": {
      const id = draw(s, "market");
      const c = marketById(id)!;
      log(s, c.name);
      if (s.marketState) repriceMarket(s, c);
      marketResponse(s, id);
      notice(
        s,
        p,
        c.name,
        `${c.description} ${s.decision ? "Eligible owners can respond in the decision panel." : "No owner has an eligible holding. The new market price still applies to future opportunities."}`,
      );
      break;
    }
    case "expense": {
      const id = draw(s, "expense");
      const card = expenses.find((e) => e.id === id)!;
      charge(s, p, card.cost, card.name, card.description);
      break;
    }
    case "charity":
      s.decision = { kind: "charity" };
      s.phase = "decision";
      notice(
        s,
        p,
        "A chance to give back",
        "A donation is optional. Use the decision panel to decide whether to contribute 10% of monthly income in exchange for extra dice.",
      );
      break;
    case "baby":
      if (p.children < 3)
        transaction(
          s,
          p,
          "A new arrival",
          (n) => {
            n.children++;
          },
          "Household costs increase.",
        );
      else {
        log(s, "Your family is complete: the three-child limit applies.");
        notice(
          s,
          p,
          "Your family is complete",
          "You already have three children. The family limit applies, so no additional expense is added.",
        );
      }
      break;
    case "downsized":
      p.skip = 2;
      p.charity = 0;
      charge(
        s,
        p,
        playerFinancials(s, p).expenses,
        "Downsized: two turns off",
        "Pay one month of expenses and miss your next two turns. Any charity dice bonus ends.",
      );
      break;
    case "dream": {
      const id = space.content!;
      const visitors = s.dreamVisits[id] ?? [];
      if (s.players.some((other) => other.id !== p.id && other.dream === id)) {
        visitors.push(p.id);
        log(s, "Another visit increased the price of this chosen dream.");
      }
      s.dreamVisits[id] = visitors;
      const humanOwner = s.players.find(
        (other) =>
          other.human &&
          !other.eliminated &&
          other.id !== p.id &&
          other.dream === id,
      );
      if (humanOwner)
        notice(
          s,
          humanOwner,
          "Your dream price increased",
          `${p.name} visited ${space.label}. Your dream now costs ${money(dreamPrice(s, id))}.`,
        );
      if (p.dream === id) {
        s.decision = { kind: "dream", id };
        s.phase = "decision";
      } else
        log(
          s,
          "A beautiful dream. Your chosen dream is elsewhere on the board.",
        );
      notice(
        s,
        p,
        space.label,
        p.dream === id
          ? "You reached your chosen dream. Use the decision panel to review the current price and decide whether to buy it."
          : "Your chosen dream is elsewhere on the board. Visiting another player’s chosen dream increases its price by one original price.",
      );
      break;
    }
    case "audit":
      charge(s, p, Math.floor(p.cash / 2), "Tax audit");
      break;
    case "lawsuit":
      charge(s, p, Math.floor(p.cash / 2), "Lawsuit settlement");
      break;
    case "divorce":
      charge(s, p, p.cash, "Divorce settlement");
      break;
  }
}
function warnLiquidity(s: GameState, p: Player) {
  if (
    !s.config.liquidityRisk ||
    s.config.accounting !== "auto" ||
    !p.human ||
    p.eliminated ||
    p.cash >= requiredReserve(p) ||
    s.economy.warned[p.id] === s.round
  )
    return;
  s.economy.warned[p.id] = s.round;
  notice(
    s,
    p,
    "Low cash reserve",
    `Cash ${preciseMoney(p.cash)} is below 10% of total debt (${preciseMoney(requiredReserve(p))}). Restore the buffer before ending your turn or face a forced sale at half equity value, then bankruptcy if the buffer cannot be restored.`,
  );
  s.notices.at(-1)!.kind = "risk";
  s.notices.at(-1)!.tone = "negative";
}
function checkLiquidity(s: GameState, p: Player, resume: "roll" | "end") {
  if (
    !s.config.liquidityRisk ||
    p.eliminated ||
    p.bankrupt ||
    p.cash >= requiredReserve(p)
  )
    return false;
  s.decision = { kind: "liquidity", resume };
  s.phase = "decision";
  warnLiquidity(s, p);
  log(
    s,
    "Liquidity crisis: restore the reserve through a forced asset sale or bankruptcy.",
    "negative",
    p,
  );
  return true;
}
function economicRound(s: GameState) {
  if (s.marketState) {
    marketRound(s);
    return;
  }
  if (s.economy.lastRound >= s.round) return;
  s.economy.lastRound = s.round;
  const before = s.players.map((p) => playerFinancials(s, p));
  const expired = s.economy.active.filter((a) => a.expires <= s.round);
  s.economy.active = s.economy.active.filter((a) => a.expires > s.round);
  let card: (typeof economicEvents)[number] | undefined;
  if (s.config.economicCycles && isEconomicRound(s.round)) {
    if (!s.economy.deck.length)
      s.economy.deck = shuffle(
        s,
        economicEvents.map((c) => c.id),
      );
    const drawn = s.economy.deck.pop();
    card = economicEvents.find((c) => c.id === drawn)!;
    s.economy.active.push({
      card: card.id,
      start: s.round,
      expires: s.round + card.duration,
    });
  }
  if (!expired.length && !card) return;
  const title = card?.name ?? "Economic conditions normalize";
  const note = [
    expired.length
      ? `Expired: ${expired.map((a) => economicEvents.find((c) => c.id === a.card)!.name).join(", ")}.`
      : "",
    card
      ? `${card.description} Active through round ${s.round + card.duration - 1}. ${card.scenario}`
      : "Temporary effects have ended. Values and recurring payments return to the remaining active conditions.",
  ]
    .filter(Boolean)
    .join(" ");
  s.players.forEach((p, i) => {
    if (p.eliminated) return;
    const after = playerFinancials(s, p),
      receipt: Receipt = {
        id: ++s.sequence,
        player: p.id,
        title,
        note,
        before: before[i],
        after,
      };
    // A shared market repricing is posted together; voluntary payments still use the auditor.
    s.receipts.unshift(receipt);
    historyPoint(s, p, title, note, "transaction", before[i], after);
  });
  s.receipts = s.receipts.slice(0, 60);
  const n = {
    id: ++s.sequence,
    kind: "cycle" as const,
    player: s.players[0].id,
    round: s.round,
    title,
    description: note,
    events: [],
    reasons: [],
    dice: [],
    changes: s.players
      .filter((p) => !p.eliminated)
      .map((p) => ({
        player: p.id,
        before: before[s.players.indexOf(p)],
        after: playerFinancials(s, p),
      })),
    tone: card?.tone ?? ("neutral" as const),
    eventId: card?.id,
  };
  s.notices.push(n);
  log(s, title, card?.tone === "negative" ? "negative" : "positive");
  for (const p of s.players) warnLiquidity(s, p);
}
function settlePrincipal(s: GameState, p: Player) {
  const due = installment(p, s.config.principalRate);
  if (!due || p.eliminated || s.economy.principalPaid[p.id] === s.round)
    return false;
  if (p.cash < due) {
    s.decision = {
      kind: "insolvency",
      amount: due,
      title: "Scheduled principal payment",
      principal: true,
    };
    s.phase = "decision";
    notice(
      s,
      p,
      "Principal payment due",
      `${preciseMoney(due)} is due. Raise cash or enter bankruptcy recovery.`,
    );
    return true;
  }
  s.economy.principalPaid[p.id] = s.round;
  transaction(
    s,
    p,
    "Scheduled principal payment",
    (n) => payInstallment(n, s.config.principalRate),
    `${s.config.principalRate}% of each outstanding balance, once per round. Principal reduces liabilities; it is not charged again as a recurring expense at Payday.`,
  );
  return !!s.pending;
}
function saleNote(q: ReturnType<typeof saleQuote>) {
  return `Sale ${preciseMoney(q.gross)} − bank fee ${preciseMoney(q.fee)} − early payoff ${preciseMoney(q.penalty)} − capital gains tax ${preciseMoney(q.tax)} − mortgage ${preciseMoney(q.mortgage)} = ${preciseMoney(q.net)} cash. Taxable profit: ${preciseMoney(q.taxableProfit)}.`;
}
function settleListedSales(s: GameState, playerId: string) {
  const owner = () => s.players.find((p) => p.id === playerId)!;
  const due = owner().assets.filter(
    (a) => a.listing && a.listing.closesRound <= s.round,
  );
  for (const asset of due) {
    const p = owner(),
      q = voluntarySaleQuote(s, asset);
    if (p.cash + q.net < 0) {
      transaction(
        s,
        p,
        `Sale cancelled: ${asset.name}`,
        (n) => {
          delete n.assets.find((a) => a.id === asset.id)!.listing;
        },
        `Closing needs ${preciseMoney(-q.net)} to clear the mortgage and costs, but only ${preciseMoney(p.cash)} is available. The asset remains yours; no fees were charged.`,
      );
    } else {
      transaction(
        s,
        p,
        `Sold ${asset.name}`,
        (n) => {
          n.cash += q.net;
          n.assets = n.assets.filter((a) => a.id !== asset.id);
        },
        `Scheduled sale completed. Agreed quick-sale discount: ${q.discountBps / 100}%. ${saleNote(q)}`,
      );
    }
    if (s.pending || s.phase === "finished") return true;
  }
  return false;
}
function drain(s: GameState) {
  while (
    s.effects.length &&
    !s.pending &&
    !s.decision &&
    s.phase !== "finished"
  ) {
    const effect = s.effects.shift()!;
    const p = s.players[s.current];
    if (effect.kind === "landing") land(s);
    else {
      introduceSpace(s, p, "payday");
      const flow = playerFinancials(s, p).flow * effect.times;
      if (flow < 0) charge(s, p, -flow, "Payday: cash flow shortfall");
      else
        transaction(
          s,
          p,
          `Payday${effect.times > 1 ? ` ×${effect.times}` : ""}`,
          (n) => {
            n.cash += flow;
          },
          "Salary + passive income − expenses",
        );
    }
  }
  if (
    !s.pending &&
    s.decision?.kind === "liquidity" &&
    s.players[s.current].cash >= requiredReserve(s.players[s.current])
  ) {
    s.phase = s.decision.resume;
    s.decision = null;
  }
  if (s.decision?.kind === "insolvency" && s.decision.principal)
    s.decision.amount = installment(
      s.players[s.current],
      s.config.principalRate,
    );
}
export function reduceGame(state: GameState, action: GameAction): GameState {
  // History entries are immutable; copying the growing timeline on every click
  // would make long matches increasingly expensive.
  const { history, ...rest } = state;
  const s = {
    ...structuredClone(rest),
    history: history ? [...history] : history,
  } as GameState;
  initializeEconomy(s);
  initializeReview(s);
  s.tutorialQueue ??= [];
  initializeMarketDynamics(s);
  s.smallDeckStage ??= "normal";
  if (action.type === "REVEAL_ROLE") {
    s.roleRevealed = true;
    return s;
  }
  if (action.type === "ACKNOWLEDGE") {
    s.notices = s.notices.filter((n) => n.id !== action.id);
    return s;
  }
  if (action.type === "CLEAR_NOTIFICATIONS") {
    s.notices = [];
    return s;
  }
  if (action.type === "ACKNOWLEDGE_GAME_OVER") {
    requireRule(s.players[0].eliminated, "Your game has not ended.");
    s.personalReviewSeen = true;
    return s;
  }
  requireRule(
    s.phase !== "finished" ||
      ["SPEED", "TUTORIAL", "TUTORIAL_MODE"].includes(action.type),
    "This match has finished. Start a new game to play again.",
  );
  if (action.type === "SPEED") {
    requireRule(
      ["instant", "fast", "normal"].includes(action.speed),
      "Invalid speed.",
    );
    s.config.speed = action.speed;
    return s;
  }
  if (action.type === "TUTORIAL_MODE") {
    s.config.tutorials = action.enabled;
    if (!action.enabled) s.tutorialQueue = [];
    return s;
  }
  if (action.type === "TUTORIAL") {
    s.tutorialDone = true;
    s.tutorialSeen = Array.from(
      new Set([...(s.tutorialSeen ?? []), ...(action.key ? [action.key] : [])]),
    );
    s.tutorialQueue = s.tutorialQueue.filter((key) => key !== action.key);
    return s;
  }
  if (action.type === "SUBMIT") {
    requireRule(s.pending, "There is no accounting to submit.");
    s.pending.values = Object.fromEntries(
      s.pending.fields.map((k) => [k, action.values[k] ?? ""]),
    );
    s.pending.errors = s.pending.fields.filter((k) => {
      const raw = action.values[k]?.replace(/[$,\s]/g, "") ?? "";
      return (
        !raw.length ||
        !Number.isFinite(Number(raw)) ||
        Math.round(Number(raw) * 100) !== s.pending!.receipt.after[k]
      );
    });
    if (!s.pending.errors.length) {
      const pending = s.pending;
      s.pending = null;
      commit(s, pending.next, pending.receipt);
      if (pending.completeDiscount) advanceDiscount(s);
      drain(s);
    }
    return s;
  }
  if (action.type === "DRAFT") {
    requireRule(
      s.pending && s.pending.fields.includes(action.field),
      "That worksheet field is not open.",
    );
    requireRule(
      typeof action.value === "string" && action.value.length <= 40,
      "Enter a shorter dollar amount.",
    );
    s.pending.values[action.field] = action.value;
    s.pending.errors = s.pending.errors.filter((k) => k !== action.field);
    return s;
  }
  requireRule(!s.pending, "Finish your worksheet before continuing.");
  if (action.type === "SELL_ANYTIME" || action.type === "CANCEL_SALE") {
    const owner = s.players.find((p) => p.id === action.playerId);
    requireRule(owner && !owner.eliminated, "Choose an active asset owner.");
    requireRule(
      owner.human || owner.id === actingPlayer(s).id,
      "NPCs manage their own holdings.",
    );
    const asset = owner.assets.find((a) => a.id === action.assetId);
    requireRule(asset, "You no longer own this asset.");
    if (action.type === "CANCEL_SALE") {
      requireRule(asset.listing, "This asset is not listed for sale.");
      delete asset.listing;
      log(s, `Cancelled the listing for ${asset.name}.`, "neutral", owner);
      return s;
    }
    requireRule(!asset.listing, "This asset is already listed for sale.");
    const q = voluntarySaleQuote(s, asset);
    requireRule(
      owner.cash + q.net >= 0,
      "You cannot cover the sale costs and remaining mortgage from your cash.",
    );
    if (asset.category === "stock") {
      transaction(
        s,
        owner,
        `Sold ${asset.name}`,
        (n) => {
          n.cash += q.net;
          n.stockGains = (n.stockGains ?? 0) + q.taxableProfit;
          n.assets = n.assets.filter((a) => a.id !== asset.id);
        },
        `Immediate stock sale, with no quick-sale discount. ${saleNote(q)}`,
      );
    } else {
      const wait = 1 + Math.floor(random(s) * 3);
      asset.listing = {
        listedRound: s.round,
        closesRound: s.round + wait,
        gross: q.gross,
        discountBps: q.discountBps,
      };
      log(
        s,
        `Listed ${asset.name}: closes at the start of round ${asset.listing.closesRound}'s turn with a ${q.discountBps / 100}% discount.`,
        "neutral",
        owner,
      );
      notice(
        s,
        owner,
        `${asset.name} listed for sale`,
        `Closes at the start of your turn in round ${asset.listing.closesRound}. Agreed gross price: ${preciseMoney(q.gross)}, after a ${q.discountBps / 100}% quick-sale discount. Income and financing continue until closing. Fees, tax and the remaining mortgage are settled then; a matching market offer can still sell it immediately without this discount.`,
      );
    }
    drain(s);
    return s;
  }
  if (s.decision?.kind === "liquidity")
    requireRule(
      ["LIQUIDATE", "BANKRUPT"].includes(action.type),
      "Resolve the liquidity crisis through a forced sale or bankruptcy first.",
    );
  if (action.type === "MODE") {
    requireRule(
      s.phase === "roll" && !s.decision,
      "Change accounting mode at the start of a turn.",
    );
    requireRule(
      ["auto", "manual"].includes(action.accounting),
      "Invalid accounting mode.",
    );
    s.config.accounting = action.accounting;
    return s;
  }
  let p = actingPlayer(s);
  requireRule(
    !p.eliminated || action.type === "END",
    "Eliminated players can only finish their turn.",
  );
  if (
    !s.turnContext &&
    s.players[s.current].id === p.id &&
    (action.type === "ROLL" || !p.human)
  )
    s.turnContext = {
      player: p.id,
      round: s.round,
      before: s.players.map((v) => ({
        player: v.id,
        values: playerFinancials(s, v),
      })),
      events: [],
      reasons: [],
      dice: [],
    };
  if (!p.human) p.decisionCount++;
  switch (action.type) {
    case "ROLL": {
      requireRule(
        s.phase === "roll",
        "You can only roll at the start of a turn.",
      );
      economicRound(s);
      if (settleListedSales(s, p.id)) break;
      p = actingPlayer(s);
      if (checkLiquidity(s, p, "roll")) break;
      if (p.skip) {
        p.skip--;
        s.phase = "end";
        log(s, `Taking a recovery turn. ${p.skip} remaining.`);
        notice(
          s,
          p,
          "A recovery turn",
          `You are taking a recovery turn. ${p.skip} recovery turns remain. ${s.config.principalRate ? "Your chosen principal autopay is still due at turn end." : "There is no mandatory principal payment."}`,
        );
        break;
      }
      if (
        p.stage === "rat" &&
        playerFinancials(s, p).passive > playerFinancials(s, p).expenses
      ) {
        if (s.config.victory === "freedom") {
          finish(s, [p.id], `${p.name} reached financial freedom.`);
          break;
        }
        p.stage = "fast";
        p.position = 0;
        p.entryIncome = playerFinancials(s, p).passive;
        log(s, "Financial freedom! Welcome to the Fast Track.", "positive");
        notice(
          s,
          p,
          "Welcome to the Fast Track",
          "Your passive income now exceeds your expenses. Your cash, holdings, and debts stay with you, and larger opportunities are unlocked.",
        );
      }
      const max = p.stage === "fast" ? (p.charity ? 3 : 2) : p.charity ? 2 : 1;
      const count = action.dice ?? max;
      requireRule(
        Number.isInteger(count) &&
          count >= 1 &&
          count <= max &&
          (p.stage !== "fast" || p.charity || count === 2),
        "That dice count is not available.",
      );
      s.dice = Array.from(
        { length: count },
        () => 1 + Math.floor(random(s) * 6),
      );
      if (s.turnContext) s.turnContext.dice = [...s.dice];
      const steps = s.dice.reduce((a, b) => a + b, 0),
        board = p.stage === "rat" ? innerBoard : fastTrackBoard(s.players);
      let passes = 0;
      for (let i = 1; i <= steps; i++)
        if (board[(p.position + i) % board.length].kind === "payday") passes++;
      p.position = (p.position + steps) % board.length;
      if (p.stage === "rat" && p.charity) p.charity--;
      s.phase = "end";
      s.effects = [
        ...(passes ? [{ kind: "payday" as const, times: passes }] : []),
        { kind: "landing" },
      ];
      log(s, `Rolled ${s.dice.join(" + ")}. Moved ${steps} spaces.`);
      break;
    }
    case "DRAW": {
      requireRule(
        s.decision?.kind === "opportunity" && !s.decision.card,
        "Choose a deck only when an opportunity is open.",
      );
      requireRule(
        action.tier === "small" || action.tier === "large",
        "Choose a valid deck.",
      );
      s.decision.tier = action.tier;
      s.decision.card = draw(s, action.tier);
      log(
        s,
        `Discovered ${deals.find((d) => d.id === (s.decision as { card?: string }).card)?.name}.`,
      );
      break;
    }
    case "BARGAIN_BUY":
    case "BUY": {
      const d = s.decision;
      const bargain = action.type === "BARGAIN_BUY";
      if (!bargain && d?.kind === "dream") {
        const price = dreamPrice(s, d.id);
        requireRule(
          p.cash >= price,
          "You need more cash to purchase this dream.",
        );
        s.decision = null;
        s.phase = "end";
        transaction(s, p, "Your dream, realized", (n) => {
          n.cash -= price;
          n.dreamOwned = true;
        });
        break;
      }
      requireRule(
        bargain || (d?.kind === "opportunity" && d.card),
        "There is no investment to purchase.",
      );
      const original = deals.find(
        (c) => c.id === (bargain ? action.card : (d as { card: string }).card),
      );
      requireRule(original, "That investment does not exist.");
      if (bargain)
        requireRule(
          canBargainBuy(s, p, original.category) &&
            d?.kind === "discount" &&
            d.card === original.id,
          "Buy only the asset offered to you in the shared discount event below 50%.",
        );
      const card = effectiveDeal(s, original);
      requireRule(
        !s.claimed.includes(card.id),
        "That Fast Track business is already owned.",
      );
      const count = card.category === "stock" ? (action.shares ?? 1) : 1;
      const quote = purchaseQuote(s, card, count, !!action.outright, p);
      const loan = action.loan ?? 0;
      requireRule(
        validLoanAmount(loan),
        "Purchase loans must be in $1,000 increments, up to $1,000,000.",
      );
      requireRule(
        !loan ||
          (!!s.marketState &&
            opportunityType(card) === 1 &&
            !action.outright &&
            !p.bankrupt &&
            !p.eliminated),
        "The 1% purchase loan is available only with a financed Type 1 acquisition, outside bankruptcy recovery.",
      );
      const lending = purchaseLending(s, p, quote, loan);
      requireRule(
        !s.marketState || lending.allowed,
        "Loan/mortgage declined: investment mortgage payments and bank-loan interest would exceed 55% of income after operating costs and mortgage financing. Starting role debt is excluded.",
      );
      requireRule(
        Number.isSafeInteger(count) && count > 0 && count <= 100000,
        "Choose a whole number of shares from 1 to 100,000.",
      );
      requireRule(
        p.cash + loan >= quote.cash,
        "You need more cash for this investment. Borrow first or pass.",
      );
      if (card.tier === "fast") s.claimed.push(card.id);
      if (!bargain) {
        s.decision = null;
        s.phase = "end";
      }
      transaction(
        s,
        p,
        `${bargain ? "Discount purchase: " : "Bought "}${card.name}${count > 1 ? ` · ${count} shares` : ""}`,
        (n) => {
          n.cash += loan - quote.cash;
          addLoan(n, loan, true, !!s.marketState);
          if (s.marketState && quote.mortgage > 0)
            n.type1Purchases = type1PurchaseCount(s, p) + 1;
          n.assets.push({
            ...assetFromDeal(quote.deal, `asset-${++s.sequence}`, count),
            boughtRound: s.round,
            acquisitionFee: quote.fee,
          });
        },
        `Cash flow is net of financing.${s.marketState ? ` Acquisition fee: ${preciseMoney(quote.fee)}; total cash paid: ${preciseMoney(quote.cash)}.${quote.mortgage ? ` Type 1 acquisition #${quote.tier}: ${Math.round(quote.downRate * 100)}% down. Mortgage: ${preciseMoney(quote.mortgage)}; operating income ${preciseMoney(lending.operating)} − financing ${preciseMoney(lending.financing)} = ${preciseMoney(lending.net)}/month.` : ""}${loan ? ` Separate purchase loan: ${preciseMoney(loan)} at 1% monthly (${preciseMoney(lending.interest)}/month). Net after purchase-loan interest: ${preciseMoney(lending.netAfterLoan)}/month.` : ""}${quote.mortgage || loan ? ` Projected DTI: ${(lending.ratio * 100).toFixed(1)}% (limit 55%).` : ""}` : ""}`,
      );
      if (bargain) completeDiscountPurchase(s);
      break;
    }
    case "SELL": {
      requireRule(
        s.decision?.kind === "market",
        "This market sale needs a matching market offer. Open Portfolio to list an asset or sell stocks anytime.",
      );
      const c = marketById((s.decision as { card: string }).card)!;
      requireRule(
        c.effect === "offer",
        "This market event is not a sale offer.",
      );
      const asset = p.assets.find((a) => a.id === action.assetId);
      requireRule(
        asset && asset.category === c.category,
        "This asset is not eligible for the offer.",
      );
      const proceeds = marketSalePrice(asset, c, s);
      requireRule(
        p.cash + proceeds >= 0,
        "You cannot cover the sale costs and remaining mortgage from your cash.",
      );
      transaction(
        s,
        p,
        `Sold ${asset.name}`,
        (n) => {
          n.cash += proceeds;
          if (s.marketState && asset.category === "stock")
            n.stockGains =
              (n.stockGains ?? 0) + marketSaleQuote(s, asset).taxableProfit;
          n.assets = n.assets.filter((a) => a.id !== asset.id);
        },
        s.marketState
          ? (() => {
              const q = marketSaleQuote(s, asset);
              return `Sale ${preciseMoney(q.gross)} − bank fee ${preciseMoney(q.fee)} − early payoff ${preciseMoney(q.penalty)} − capital gains tax ${preciseMoney(q.tax)} − mortgage ${preciseMoney(q.mortgage)} = ${preciseMoney(q.net)} cash. Taxable profit: ${preciseMoney(q.taxableProfit)}.`;
            })()
          : "Sale proceeds are after mortgage settlement.",
      );
      break;
    }
    case "TRANSFER": {
      requireRule(
        s.decision?.kind === "opportunity" &&
          s.decision.card &&
          !s.decision.transferred,
        "This opportunity cannot be transferred.",
      );
      const card = effectiveDeal(
        s,
        deals.find((d) => d.id === (s.decision as { card: string }).card)!,
      );
      requireRule(card.transferable, "This card does not permit a transfer.");
      const target = s.players[action.target];
      requireRule(
        target && !target.human && !target.eliminated && target.id !== p.id,
        "Choose an eligible NPC.",
      );
      requireRule(
        Number.isSafeInteger(action.price) &&
          action.price >= 0 &&
          action.price <= dollars(1000000),
        "Enter a valid transfer price.",
      );
      const outright = !!s.marketState && target.profile === "income",
        acquisition = purchaseQuote(s, card, 1, outright, target),
        boughtCard = acquisition.deal,
        policy = personalities[target.profile],
        targetFinances = playerFinancials(s, target);
      requireRule(
        !s.marketState || purchaseLending(s, target, acquisition).allowed,
        "That player's mortgage would exceed the 55% debt-to-income limit.",
      );
      requireRule(
        target.cash >= acquisition.cash + action.price,
        "That player cannot afford the deal and fee.",
      );
      if (s.marketState)
        requireRule(
          !(target.profile === "cautious" && opportunityType(card) === 1) &&
            !(
              target.profile === "income" && (target.stockGains ?? 0) < 2000000
            ),
          "That player's personality declines this type of investment.",
        );
      const reserve = s.marketState
        ? Math.ceil(
            (targetFinances.debt + acquisition.mortgage) *
              Math.max(policy.debtRatio, s.config.liquidityRisk ? 0.1 : 0),
          ) +
          Math.round(
            targetFinances.expenses *
              policy.months *
              (s.config.difficulty === "hard" ? 1.1 : 1),
          ) +
          installment(target, s.config.principalRate) +
          Math.round((acquisition.mortgage * s.config.principalRate) / 100)
        : (s.config.liquidityRisk
            ? requiredReserve(target) + card.mortgage / 10
            : 0) +
          installment(target, s.config.principalRate) +
          playerFinancials(s, target).expenses *
            (target.profile === "cautious"
              ? 2
              : target.profile === "bold"
                ? 0.3
                : 1);
      requireRule(
        target.cash - acquisition.cash - action.price >= reserve &&
          ((s.marketState &&
            (target.profile === "bold" ||
              (target.profile === "income" &&
                assetIncome(s, assetFromDeal(boughtCard, "preview")) > 0))) ||
            (assetIncome(s, assetFromDeal(boughtCard, "preview")) * 12) /
              (acquisition.cash + action.price) >=
              (s.marketState ? 0.08 : 0.15)),
        "That player declines: the reserve or expected return is too low.",
      );
      s.decision = null;
      s.phase = "end";
      transaction(
        s,
        target,
        `Accepted ${card.name}`,
        (n) => {
          n.cash -= acquisition.cash + action.price;
          if (s.marketState && acquisition.mortgage > 0)
            n.type1Purchases = type1PurchaseCount(s, target) + 1;
          n.assets.push({
            ...assetFromDeal(boughtCard, `asset-${++s.sequence}`, 1),
            boughtRound: s.round,
            acquisitionFee: acquisition.fee,
          });
        },
        `Paid ${money(action.price)} for the opportunity.${s.marketState ? ` Acquisition fee: ${preciseMoney(acquisition.fee)}.${outright ? " Purchased outright without financing." : ""}` : ""}`,
      );
      transaction(s, p, "Opportunity transfer fee", (n) => {
        n.cash += action.price;
      });
      break;
    }
    case "CHARITY": {
      requireRule(
        s.decision?.kind === "charity",
        "You are not on a charity space.",
      );
      if (action.accept) {
        const amount = Math.round(playerFinancials(s, p).income / 10);
        requireRule(p.cash >= amount, "You need enough cash for the donation.");
        s.decision = null;
        s.phase = "end";
        transaction(
          s,
          p,
          "A little generosity",
          (n) => {
            n.cash -= amount;
            n.charity = n.stage === "fast" ? 999 : 3;
          },
          p.stage === "fast"
            ? "Choose 1–3 dice on future turns."
            : "Up to two dice for your next three turns.",
        );
      } else {
        s.decision = null;
        s.phase = "end";
      }
      break;
    }
    case "BORROW": {
      requireRule(
        !p.bankrupt,
        "Bank loans return after your bankruptcy recovery turns.",
      );
      requireRule(p.id === s.players[s.current].id, "Borrow on your own turn.");
      requireRule(
        Number.isSafeInteger(action.amount) &&
          action.amount > 0 &&
          action.amount % dollars(1000) === 0 &&
          action.amount <= dollars(1000000),
        "Bank loans must be positive $1,000 increments, up to $1,000,000.",
      );
      requireRule(!p.eliminated, "Eliminated players cannot borrow.");
      requireRule(
        !s.marketState || borrowingQuote(s, p, action.amount).allowed,
        "Loan declined: bank-loan interest and investment mortgage payments would exceed 55% of income. Starting role debt is excluded.",
      );
      transaction(
        s,
        p,
        "Bank loan",
        (n) => {
          n.cash += action.amount;
          addLoan(n, action.amount, false, !!s.marketState);
        },
        s.marketState
          ? "2% monthly interest on outstanding principal, charged each payday. Separate from 1% Type 1 purchase loans. DTI checked against a 55% limit; starting role debt excluded."
          : `${s.config.annualRate}% annual simple interest, charged each payday.`,
      );
      break;
    }
    case "REPAY": {
      requireRule(
        p.id === s.players[s.current].id,
        "Repay debt on your own turn.",
      );
      const debt = p.debts.find((d) => d.id === action.debtId),
        asset = p.assets.find((a) => a.id === action.debtId && a.mortgage > 0);
      requireRule(debt || asset, "This debt does not exist.");
      const balance = debt?.principal ?? asset!.mortgage,
        amount = action.amount ?? balance;
      requireRule(
        Number.isSafeInteger(amount) &&
          amount > 0 &&
          amount <= balance &&
          p.cash >= amount,
        "Enter a positive repayment no greater than your cash or the remaining balance.",
      );
      transaction(
        s,
        p,
        `Repaid ${debt?.name ?? asset!.name + " mortgage"}`,
        (n) => {
          n.cash -= amount;
          repayPrincipal(n, action.debtId, amount);
        },
        `${preciseMoney(amount)} of principal repaid. Future recurring payments decrease proportionally.`,
      );
      break;
    }
    case "LIQUIDATE": {
      requireRule(
        s.decision?.kind === "insolvency" || s.decision?.kind === "liquidity",
        "Distress sales are only available during insolvency.",
      );
      const a = p.assets.find((a) => a.id === action.assetId);
      requireRule(a, "Asset not found.");
      transaction(
        s,
        p,
        `Distress sale: ${a.name}`,
        (n) => {
          n.cash += distressValue(s, a);
          n.assets = n.assets.filter((v) => v.id !== a.id);
        },
        "Forced sale at 50% of current equity (market value minus financing). Associated financing is settled and removed; recurring income is lost.",
      );
      break;
    }
    case "BANKRUPT": {
      requireRule(
        s.decision?.kind === "insolvency" || s.decision?.kind === "liquidity",
        "Bankruptcy is only available when a payment cannot be met.",
      );
      const liquidity = s.decision.kind === "liquidity";
      const principal =
        s.decision.kind === "insolvency" && s.decision.principal;
      const bill = s.decision.kind === "insolvency" ? s.decision.amount : 0;
      if (principal) s.economy.principalPaid[p.id] = s.round;
      s.decision = null;
      s.effects = [];
      s.phase = "end";
      transaction(
        s,
        p,
        "Bankruptcy recovery",
        (n) => {
          // Rulebook recovery: distress sales, debt repayment, three lost turns,
          // then one-time 50% car/card/retail relief if cash flow stays negative.
          for (const a of [...n.assets]) {
            if (
              n.cash >= bill &&
              (!liquidity || n.cash >= requiredReserve(n)) &&
              finances(n, s.config.annualRate, s).flow > 0
            )
              break;
            n.cash += distressValue(s, a);
            n.assets = n.assets.filter((v) => v.id !== a.id);
          }
          const sorted = [...n.debts].sort(
            (a, b) =>
              debtPayment(s, b) / b.principal - debtPayment(s, a) / a.principal,
          );
          for (const d of sorted) {
            if (finances(n, s.config.annualRate, s).flow > 0) break;
            const available = Math.max(0, n.cash - bill);
            const amount =
              d.kind === "bank" || d.kind === "purchase"
                ? Math.min(
                    d.principal,
                    Math.floor(available / dollars(1000)) * dollars(1000),
                  )
                : available >= d.principal
                  ? d.principal
                  : 0;
            if (amount) {
              n.cash -= amount;
              repayPrincipal(n, d.id, amount);
            }
          }
          if (finances(n, s.config.annualRate, s).flow <= 0 && !n.debtRelief) {
            n.debtRelief = true;
            for (const d of n.debts)
              if (["car", "credit", "retail"].includes(d.kind)) {
                d.principal = Math.round(d.principal / 2);
                d.payment = Math.round(d.payment / 2);
                d.paymentBasis = { principal: d.principal, payment: d.payment };
              }
          }
          const payment = principal
            ? installment(n, s.config.principalRate)
            : bill;
          if (
            n.cash < payment ||
            (liquidity && n.cash < requiredReserve(n)) ||
            finances(n, s.config.annualRate, s).flow <= 0
          ) {
            n.eliminated = true;
            n.skip = 0;
          } else {
            if (principal) payInstallment(n, s.config.principalRate);
            else n.cash -= bill;
            n.skip = 3;
            n.bankrupt = true;
          }
        },
        "Distress recovery and debt review. Successful recovery costs three turns; unrecoverable players leave the game.",
      );
      break;
    }
    case "PASS": {
      requireRule(
        s.phase === "decision" && s.decision,
        "There is no decision to pass.",
      );
      if (s.decision.kind === "insolvency") {
        const d = s.decision;
        requireRule(
          p.cash >= d.amount,
          "Raise cash or use bankruptcy recovery before continuing.",
        );
        s.decision = null;
        s.phase = "end";
        if (d.principal) settlePrincipal(s, p);
        else charge(s, p, d.amount, d.title);
        break;
      }
      if (s.decision.kind === "discount") {
        const card = effectiveDeal(
          s,
          deals.find((c) => c.id === (s.decision as { card: string }).card)!,
        );
        const f = playerFinancials(s, p),
          quote = purchaseQuote(s, card);
        const point = historyPoint(
          s,
          p,
          `Passed on discounted ${card.name}`,
          "Kept cash instead of buying the shared market offer.",
          "decision",
          f,
          f,
        );
        point.opportunity = {
          down: quote.cash,
          income: assetIncome(s, assetFromDeal(quote.deal, "review")),
          affordable:
            p.cash >= quote.cash &&
            (!s.marketState || purchaseLending(s, p, quote).allowed),
        };
        log(s, `Passed on discounted ${card.name}.`, "neutral", p);
        advanceDiscount(s);
      } else if (s.decision.kind === "market") {
        const d = s.decision,
          c = marketById(d.card)!;
        if (d.remaining.length)
          s.decision = {
            ...d,
            responder: d.remaining[0],
            remaining: d.remaining.slice(1),
          };
        else {
          s.decision = null;
          s.phase = "end";
          if (s.marketState) startDiscountOffer(s, d.card);
        }
        if (c.effect === "split")
          transaction(
            s,
            p,
            "Two-for-one share split",
            (n) => {
              for (const a of n.assets)
                if (a.category === "stock") {
                  a.shares *= 2;
                  a.unitPrice = Math.round(a.unitPrice / 2);
                }
            },
            "Total investment value and income are unchanged.",
          );
        if (c.effect === "dividend")
          transaction(s, p, "Special shareholder distribution", (n) => {
            n.cash += n.assets
              .filter((a) => a.category === "stock")
              .reduce((v, a) => v + a.shares * c.amount, 0);
          });
      } else {
        if (s.decision.kind === "opportunity" && s.decision.card) {
          const original = deals.find(
            (c) => c.id === (s.decision as { card: string }).card,
          )!;
          const card = effectiveDeal(s, original);
          const f = playerFinancials(s, p),
            quote = purchaseQuote(s, card, 1, false, p);
          const point = historyPoint(
            s,
            p,
            `Passed on ${card.name}`,
            "Kept cash instead of purchasing the offered investment.",
            "decision",
            f,
            f,
          );
          point.opportunity = {
            down: quote.cash,
            income: assetIncome(s, assetFromDeal(quote.deal, "review")),
            affordable:
              p.cash >= quote.cash &&
              (!s.marketState || purchaseLending(s, p, quote).allowed),
          };
        }
        s.decision = null;
        s.phase = "end";
        log(s, "Passed on this opportunity.");
      }
      break;
    }
    case "END": {
      requireRule(
        s.phase === "end" && !s.decision && !s.effects.length,
        "Resolve the current event first.",
      );
      if (settlePrincipal(s, p)) break;
      if (checkLiquidity(s, s.players[s.current], "end")) break;
      // The final recovery turn keeps its exemption through its payment and
      // liquidity check. Normal reserve enforcement resumes on the next turn.
      if (!s.players[s.current].skip) s.players[s.current].bankrupt = false;
      const active = s.players.filter((p) => !p.eliminated);
      if (active.length <= 1) {
        finish(
          s,
          active.map((p) => p.id),
          active.length
            ? `${active[0].name} is the last player standing.`
            : "All players were eliminated.",
        );
        break;
      }
      let next = s.current;
      do {
        next = (next + 1) % s.players.length;
      } while (s.players[next].eliminated);
      if (next <= s.current) s.round++;
      if (s.config.roundLimit && s.round > s.config.roundLimit) {
        const rank = active
          .map((p) => ({ p, f: playerFinancials(s, p) }))
          .sort(
            (a, b) =>
              b.f.passive / Math.max(1, b.f.expenses) -
                a.f.passive / Math.max(1, a.f.expenses) ||
              b.f.netWorth - a.f.netWorth,
          );
        const top = rank[0];
        const winners = rank
          .filter(
            (r) =>
              r.f.passive / Math.max(1, r.f.expenses) ===
                top.f.passive / Math.max(1, top.f.expenses) &&
              r.f.netWorth === top.f.netWorth,
          )
          .map((r) => r.p.id);
        finish(
          s,
          winners,
          "Round limit reached. Ranked by financial freedom, then net worth.",
        );
        break;
      }
      s.current = next;
      s.phase = "roll";
      s.dice = [];
      break;
    }
  }
  drain(s);
  const ended =
    action.type === "END" &&
    (s.current !== state.current ||
      s.round !== state.round ||
      s.phase === "finished");
  if (!p.human && (ended || s.phase === "finished")) summarizeTurn(s, p);
  else if (ended) s.turnContext = null;
  if (
    ended &&
    s.round !== state.round &&
    s.phase !== "finished" &&
    s.marketState
  )
    marketRound(s);
  s.notices = s.notices.slice(-40);
  return s;
}
export function assetFromDeal(card: Deal, id: string, count = 1): Asset {
  return {
    id,
    cardId: card.id,
    name: card.name,
    category: card.category,
    cost: card.cost * count,
    referenceValue: (card.referenceCost ?? card.cost) * count,
    down: card.down * count,
    mortgage: card.mortgage * count,
    income: card.income * count,
    financing: card.financing * count,
    shares: card.category === "stock" ? count : 1,
    unitPrice: card.unitPrice,
    distress: card.distress * count,
  };
}
