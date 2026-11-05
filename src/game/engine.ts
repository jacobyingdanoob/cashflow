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
  FinancialHistoryPoint,
} from "./types";
import {
  assetIncome,
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
          (d.kind === "bank"
            ? Math.round((d.principal * annualRate) / 1200)
            : d.payment) * factor(state, "loanPayments"),
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
      ["easy", "standard", "hard"].includes(config.roleDifficulty) &&
      [0, 0.5, 1, 2].includes(config.principalRate),
    "Choose supported risk and principal settings.",
  );
  requireRule(
    Number.isInteger(config.opponents) &&
      config.opponents >= 1 &&
      config.opponents <= 5,
    "Choose between one and five opponents.",
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
  const selected = pool.indexOf(humanRole);
  [pool[0], pool[selected]] = [pool[selected], pool[0]];
  for (let i = 0; i <= config.opponents; i++) {
    const pr = professions.find((p) => p.id === pool[i])!;
    const availableDreams = dreams.filter(
      (d) => !s.players.some((p) => p.dream === d.id),
    );
    const p: Player = {
      id: `p${i}`,
      name: ["You", "Maya", "Oliver", "Sofia", "Theo", "Amara"][i],
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
    };
    p.cash = Math.round(
      (pr.savings + finances(p, config.annualRate).flow) * config.startingCash,
    );
    if (config.liquidityRisk) p.cash += requiredReserve(p);
    s.players.push(p);
  }
  for (const kind of ["small", "large", "market", "expense"] as const)
    s.decks[kind] = shuffle(s, deckIds(s.config, kind, s.smallDeckStage));
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
) {
  if (kind === "small")
    return deals
      .filter((c) => c.tier === "small" && (config.adaptedCards || !c.source))
      .flatMap((c) =>
        Array<string>(smallDealCopies(c, stage === "early")).fill(c.id),
      );
  const cards =
    kind === "market"
      ? markets
      : kind === "expense"
        ? expenses
        : deals.filter((c) => c.tier === kind);
  return cards.filter((c) => config.adaptedCards || !c.source).map((c) => c.id);
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
    s.decks[kind] = shuffle(s, deckIds(s.config, kind, s.smallDeckStage));
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
  const c = markets.find((m) => m.id === cardId);
  return c ? p.assets.filter((a) => a.category === c.category) : [];
}
export const salePrice = (a: Asset, multiplier: number, state?: GameState) =>
  Math.round(assetValue(state, a) * multiplier) - a.mortgage;
export const marketSalePrice = (
  a: Asset,
  card: MarketCard,
  state?: GameState,
) =>
  card.sharePrice !== undefined
    ? Math.round(card.sharePrice * factor(state, "values", "stock")) *
        a.shares -
      a.mortgage
    : salePrice(a, card.multiplier, state);
export function dreamPrice(s: GameState, id: string) {
  return (
    Math.round(
      dreams.find((d) => d.id === id)!.cost * s.config.dreamMultiplier,
    ) *
    (1 + (s.dreamVisits[id]?.length ?? 0))
  );
}
function responder(s: GameState) {
  return s.decision?.kind === "market" ? s.decision.responder : s.current;
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
function marketResponse(s: GameState, card: string) {
  const queue = s.players
    .map((p, i) =>
      !p.eliminated && eligibleAssets(s, p, card).length ? i : -1,
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
      const event = markets.find((m) => m.id === card)!;
      notice(
        s,
        s.players[0],
        event.name,
        `${s.players[s.current].name} drew this market event. ${event.description} You hold an eligible investment. Use the decision panel to review your response.`,
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
      const c = markets.find((c) => c.id === id)!;
      log(s, c.name);
      marketResponse(s, id);
      notice(
        s,
        p,
        c.name,
        `${c.description} ${s.decision ? "Eligible owners can respond in the decision panel." : "Nobody holds an eligible asset, so no financial change occurs."}`,
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
    s.phase !== "finished" || action.type === "SPEED",
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
  if (action.type === "TUTORIAL") {
    s.tutorialDone = true;
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
  const p = actingPlayer(s);
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
    case "BUY": {
      const d = s.decision;
      if (d?.kind === "dream") {
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
        d?.kind === "opportunity" && d.card,
        "There is no investment to purchase.",
      );
      const card = effectiveDeal(
        s,
        deals.find((c) => c.id === d.card)!,
      );
      requireRule(
        !s.claimed.includes(card.id),
        "That Fast Track business is already owned.",
      );
      const count = card.category === "stock" ? (action.shares ?? 1) : 1;
      requireRule(
        Number.isSafeInteger(count) && count > 0 && count <= 100000,
        "Choose a whole number of shares from 1 to 100,000.",
      );
      requireRule(
        p.cash >= card.down * count,
        "You need more cash for this investment. Borrow first or pass.",
      );
      if (card.tier === "fast") s.claimed.push(card.id);
      s.decision = null;
      s.phase = "end";
      transaction(
        s,
        p,
        `Bought ${card.name}${count > 1 ? ` · ${count} shares` : ""}`,
        (n) => {
          n.cash -= card.down * count;
          n.assets.push(assetFromDeal(card, `asset-${++s.sequence}`, count));
        },
        "Cash flow is net of financing.",
      );
      break;
    }
    case "SELL": {
      requireRule(
        s.decision?.kind === "market",
        "Assets can only be sold during an eligible market event.",
      );
      const c = markets.find(
        (m) => m.id === (s.decision as { card: string }).card,
      )!;
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
        "You cannot cover the mortgage shortfall on this sale.",
      );
      transaction(
        s,
        p,
        `Sold ${asset.name}`,
        (n) => {
          n.cash += proceeds;
          n.assets = n.assets.filter((a) => a.id !== asset.id);
        },
        "Sale proceeds are after mortgage settlement.",
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
      requireRule(
        target.cash >= card.down + action.price,
        "That player cannot afford the deal and fee.",
      );
      const reserve =
        (s.config.liquidityRisk
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
        target.cash - card.down - action.price >= reserve &&
          (assetIncome(s, assetFromDeal(card, "preview")) * 12) /
            (card.down + action.price) >=
            0.15,
        "That player declines: the reserve or expected return is too low.",
      );
      s.decision = null;
      s.phase = "end";
      transaction(
        s,
        target,
        `Accepted ${card.name}`,
        (n) => {
          n.cash -= card.down + action.price;
          n.assets.push(assetFromDeal(card, `asset-${++s.sequence}`, 1));
        },
        `Paid ${money(action.price)} for the opportunity.`,
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
      transaction(
        s,
        p,
        "Bank loan",
        (n) => {
          n.cash += action.amount;
          const loan = n.debts.find((d) => d.kind === "bank");
          if (loan) loan.principal += action.amount;
          else
            n.debts.push({
              id: "bank",
              name: "Bank loan",
              kind: "bank",
              principal: action.amount,
              payment: 0,
            });
        },
        `${s.config.annualRate}% annual simple interest, charged each payday.`,
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
            (a, b) => b.payment / b.principal - a.payment / a.principal,
          );
          for (const d of sorted) {
            if (finances(n, s.config.annualRate, s).flow > 0) break;
            const available = Math.max(0, n.cash - bill);
            const amount =
              d.kind === "bank"
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
      if (s.decision.kind === "market") {
        const d = s.decision,
          c = markets.find((c) => c.id === d.card)!;
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
          const f = playerFinancials(s, p);
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
            down: card.down,
            income: assetIncome(s, assetFromDeal(card, "review")),
            affordable: p.cash >= card.down,
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
