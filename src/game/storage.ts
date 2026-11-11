import {
  deals,
  dreams,
  expenses,
  innerBoard,
  markets,
  outerBoard,
  professions,
  smallDealCopies,
  marketById,
} from "./content";
import {
  allModernMarkets,
  marketCategories,
  marketCopies,
  nextMarketIndex,
} from "./market";
import {
  initializeMarketDynamics,
  marketTrends,
  cycleRange,
  cycleMovement,
} from "./trends";
import { createGame, initializeReview, playerFinancials } from "./engine";
import { economicEvents, initializeEconomy } from "./economy";
import { discountCandidates } from "./bargains";
import { QUICK_SALE_DISCOUNT_BPS } from "./sales";
import { tutorialTopics } from "./tutorials";
import type {
  AccountingField,
  Financials,
  GameState,
  Player,
  Receipt,
  MarketDepression,
  AssetCategory,
} from "./types";
const PREFIX = "cashflow.v1.";
export interface SaveRecord {
  name: string;
  savedAt: string;
  state: GameState;
}
function isMoney(n: unknown): n is number {
  return (
    Number.isSafeInteger(n) && Math.abs(n as number) <= Number.MAX_SAFE_INTEGER
  );
}
function check(
  ok: unknown,
  message = "A record in this save is damaged. Choose another slot; your other saves are safe.",
): asserts ok {
  if (!ok) throw new Error(message);
}
function record(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function validDepression(d: MarketDepression, round: number) {
  return (
    record(d) &&
    Number.isInteger(d.start) &&
    d.start >= 1 &&
    d.start <= round &&
    Number.isInteger(d.expires) &&
    d.expires - d.start >= 5 &&
    d.expires - d.start <= 10
  );
}
function validBargainBuys(p: Player, round: number) {
  if (p.bargainBuys !== undefined)
    check(
      record(p.bargainBuys) &&
        Object.entries(p.bargainBuys).every(
          ([category, bought]) =>
            marketCategories.includes(
              category as (typeof marketCategories)[number],
            ) &&
            Number.isInteger(bought) &&
            bought >= 1 &&
            bought <= round,
        ),
    );
}
function validFinancial(f: Financials) {
  return (
    f &&
    financialKeys.every((k) => isMoney(f[k])) &&
    f.cash >= 0 &&
    f.flow === f.income - f.expenses &&
    f.netWorth === f.cash + f.assets - f.debt
  );
}
function validPlayer(p: Player) {
  check(
    p.type1Purchases === undefined ||
      (Number.isSafeInteger(p.type1Purchases) && p.type1Purchases >= 0),
  );
  check(
    p.stockGains === undefined || (isMoney(p.stockGains) && p.stockGains >= 0),
  );
  check(
    p &&
      typeof p.id === "string" &&
      typeof p.name === "string" &&
      typeof p.human === "boolean" &&
      ["cautious", "income", "bold", "diverse"].includes(p.profile),
  );
  check(
    professions.some((pr) => pr.id === p.profession) &&
      dreams.some((d) => d.id === p.dream) &&
      ["rat", "fast"].includes(p.stage),
  );
  check(
    [p.cash, p.salary, p.taxes, p.living, p.childCost, p.entryIncome].every(
      (n) => isMoney(n) && n >= 0,
    ),
  );
  check(
    Number.isInteger(p.position) &&
      p.position >= 0 &&
      p.position < (p.stage === "rat" ? innerBoard.length : outerBoard.length),
  );
  check(
    Number.isInteger(p.children) &&
      p.children >= 0 &&
      p.children <= 3 &&
      Number.isInteger(p.skip) &&
      p.skip >= 0 &&
      p.skip <= 3 &&
      Number.isInteger(p.charity) &&
      p.charity >= 0 &&
      p.charity <= 999,
  );
  check(
    typeof p.dreamOwned === "boolean" &&
      typeof p.eliminated === "boolean" &&
      typeof p.debtRelief === "boolean" &&
      /^#[0-9a-f]{6}$/i.test(p.color) &&
      Number.isSafeInteger(p.decisionCount) &&
      p.decisionCount >= 0,
  );
  p.bankrupt ??= false;
  check(typeof p.bankrupt === "boolean");
  if (p.elimination !== undefined)
    check(
      record(p.elimination) &&
        p.eliminated &&
        Number.isInteger(p.elimination.round) &&
        p.elimination.round >= 1 &&
        typeof p.elimination.reason === "string" &&
        validFinancial(p.elimination.financials),
    );
  check(Array.isArray(p.assets) && Array.isArray(p.debts));
  for (const a of p.assets) {
    if (a.listing !== undefined) {
      const listing = a.listing;
      check(
        record(listing) &&
          a.category !== "stock" &&
          Number.isSafeInteger(listing.listedRound) &&
          listing.listedRound >= 1 &&
          Number.isSafeInteger(listing.closesRound) &&
          listing.closesRound - listing.listedRound >= 1 &&
          listing.closesRound - listing.listedRound <= 3 &&
          isMoney(listing.gross) &&
          listing.gross >= 0 &&
          listing.discountBps === QUICK_SALE_DISCOUNT_BPS[a.category],
      );
    }
    check(
      (a.boughtRound === undefined ||
        (Number.isSafeInteger(a.boughtRound) && a.boughtRound >= 1)) &&
        (a.acquisitionFee === undefined ||
          (isMoney(a.acquisitionFee) && a.acquisitionFee >= 0)),
    );
    check(
      (a.referenceValue === undefined ||
        (isMoney(a.referenceValue) && a.referenceValue >= 0)) &&
        (!a.financingBasis ||
          (isMoney(a.financingBasis.principal) &&
            a.financingBasis.principal > 0 &&
            isMoney(a.financingBasis.payment) &&
            a.financingBasis.payment >= 0)),
    );
    check(
      a &&
        typeof a.id === "string" &&
        typeof a.name === "string" &&
        deals.some((c) => c.id === a.cardId && c.category === a.category),
    );
    check(
      [a.cost, a.down, a.mortgage, a.financing, a.distress, a.unitPrice].every(
        (n) => isMoney(n) && n >= 0,
      ) &&
        isMoney(a.income) &&
        Number.isInteger(a.shares) &&
        a.shares > 0,
    );
  }
  for (const d of p.debts)
    check(
      d &&
        (!d.paymentBasis ||
          (isMoney(d.paymentBasis.principal) &&
            d.paymentBasis.principal > 0 &&
            isMoney(d.paymentBasis.payment) &&
            d.paymentBasis.payment >= 0)) &&
        typeof d.id === "string" &&
        typeof d.name === "string" &&
        (d.monthlyRateBps === undefined ||
          (d.kind === "bank" && d.monthlyRateBps === 200) ||
          (d.kind === "purchase" && d.monthlyRateBps === 100)) &&
        (d.kind !== "purchase" || d.monthlyRateBps === 100) &&
        [
          "home",
          "school",
          "car",
          "credit",
          "retail",
          "bank",
          "purchase",
        ].includes(d.kind) &&
        isMoney(d.principal) &&
        d.principal >= 0 &&
        isMoney(d.payment) &&
        d.payment >= 0,
    );
  check(
    new Set(p.assets.map((a) => a.id)).size === p.assets.length &&
      new Set(p.debts.map((d) => d.id)).size === p.debts.length,
  );
}
const financialKeys: (keyof Financials)[] = [
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
const worksheetKeys: AccountingField[] = [
  "cash",
  "assets",
  "debt",
  "income",
  "expenses",
  "passive",
  "flow",
];
function validReceipt(r: Receipt, ids: string[]) {
  check(
    r &&
      Number.isSafeInteger(r.id) &&
      ids.includes(r.player) &&
      typeof r.title === "string" &&
      typeof r.note === "string" &&
      r.before &&
      r.after,
  );
  for (const f of [r.before, r.after])
    check(
      financialKeys.every((k) => isMoney(f[k])) &&
        f.cash >= 0 &&
        f.flow === f.income - f.expenses &&
        f.netWorth === f.cash + f.assets - f.debt,
    );
}
export function validateSave(value: unknown): GameState {
  const s = structuredClone(value) as GameState;
  if (!s || s.version !== 1 || s.contentVersion !== 1 || !s.config)
    throw new Error(
      "This save uses an unsupported version. Your other saves are safe.",
    );
  // Re-use configuration validation without trusting imported values.
  // Earlier matches already used the combined decks; preserve their order and holdings.
  if (s.config.adaptedCards === undefined) s.config.adaptedCards = true;
  // Existing matches predate the guide. Keep them quiet until the player
  // explicitly enables tutorials in settings; new games use the default.
  if (s.config.tutorials === undefined) s.config.tutorials = false;
  if (s.config.roleDifficulty === undefined)
    s.config.roleDifficulty =
      professions.find((p) => p.id === s.players?.[0]?.profession)
        ?.difficulty ?? "standard";
  if (s.roleRevealed === undefined) s.roleRevealed = true;
  check(typeof s.roleRevealed === "boolean");
  if (s.personalReviewSeen === undefined) s.personalReviewSeen = false;
  check(typeof s.personalReviewSeen === "boolean");
  if (s.tutorialSeen === undefined)
    s.tutorialSeen = s.tutorialDone ? ["intro"] : [];
  check(
    Array.isArray(s.tutorialSeen) &&
      s.tutorialSeen.every((key) => typeof key === "string"),
  );
  if (s.tutorialQueue === undefined) s.tutorialQueue = [];
  check(
    Array.isArray(s.tutorialQueue) &&
      new Set(s.tutorialQueue).size === s.tutorialQueue.length &&
      s.tutorialQueue.every(
        (key) => tutorialTopics.includes(key) && !s.tutorialSeen.includes(key),
      ),
  );
  if (s.smallDeckStage === undefined) s.smallDeckStage = "normal";
  check(["early", "normal"].includes(s.smallDeckStage));
  if (s.economy === undefined) initializeEconomy(s);
  createGame(s.config);
  if (
    !Array.isArray(s.players) ||
    s.players.length !== s.config.opponents + 1 ||
    s.players[0]?.human !== true ||
    s.players.slice(1).some((p) => p.human) ||
    !Number.isInteger(s.current) ||
    s.current < 0 ||
    s.current >= s.players.length ||
    !Number.isInteger(s.round) ||
    s.round < 1 ||
    !Number.isInteger(s.rng) ||
    s.rng <= 0 ||
    s.rng > 4294967295 ||
    !["roll", "decision", "end", "finished"].includes(s.phase)
  )
    throw new Error(
      "The saved match is incomplete. Choose another slot or start a new game.",
    );
  s.players.forEach(validPlayer);
  s.players.forEach((p) =>
    p.assets.forEach((a) =>
      check(!a.listing || a.listing.listedRound <= s.round),
    ),
  );
  s.players.forEach((p) => validBargainBuys(p, s.round));
  const ids = s.players.map((p) => p.id),
    index = (n: number) =>
      Number.isInteger(n) && n >= 0 && n < s.players.length;
  check(new Set(ids).size === ids.length);
  if (s.marketState !== undefined) {
    const m = s.marketState;
    check(
      record(m) &&
        m.version === 1 &&
        record(m.indices) &&
        Array.isArray(m.history),
    );
    check(
      marketCategories.every(
        (c) =>
          Number.isSafeInteger(m.indices[c]) &&
          m.indices[c] >= 1000 &&
          m.indices[c] <= 50000,
      ),
    );
    const running = { stock: 10000, property: 10000, business: 10000 };
    const depressionHistory: Partial<Record<AssetCategory, MarketDepression>> =
      {};
    let lastId = 0,
      lastRound = 1;
    for (const tick of m.history) {
      check(
        tick &&
          marketCategories.includes(tick.category) &&
          Number.isSafeInteger(tick.id) &&
          tick.id > lastId &&
          tick.id <= s.sequence &&
          Number.isInteger(tick.round) &&
          tick.round >= lastRound &&
          tick.round <= s.round &&
          (ids.includes(tick.player) ||
            (tick.player === "" &&
              ["drift", "trend"].includes(tick.source ?? ""))) &&
          typeof tick.title === "string" &&
          tick.before === running[tick.category] &&
          Number.isInteger(tick.after) &&
          tick.after >= 1000 &&
          tick.after <= 50000,
      );
      let multiplier: number;
      check(tick.model === undefined || tick.model === 2);
      if (tick.source === "drift" || tick.source === "trend") {
        check(Number.isSafeInteger(tick.changeBps));
        const bps = tick.changeBps!;
        if (tick.model === 2) {
          const noise = tick.fluctuationBps;
          check(
            Number.isInteger(noise) &&
              (tick.category === "stock"
                ? Math.abs(noise!) >= 200 && Math.abs(noise!) <= 300
                : Math.abs(noise!) <=
                  (tick.category === "property" ? 25 : 100)),
          );
        }
        if (tick.source === "drift") {
          check(
            tick.card === `drift-${tick.category}` &&
              (tick.category === "stock"
                ? Math.abs(bps) >= 200 && Math.abs(bps) <= 300
                : Math.abs(bps) <= (tick.category === "property" ? 25 : 100)),
          );
          if (tick.model === 2)
            check(
              bps === tick.fluctuationBps && tick.cycleDrawBps === undefined,
            );
        } else {
          const trend = marketTrends.find((c) => c.id === tick.card);
          check(
            trend &&
              Number.isInteger(tick.trendStart) &&
              tick.trendStart! >= 5 &&
              tick.trendStart! % 5 === 0 &&
              tick.round >= tick.trendStart! &&
              tick.round < tick.trendStart! + trend.duration,
          );
          if (tick.model === 2) {
            const range = cycleRange(trend, tick.category),
              base = tick.cycleDrawBps;
            check(
              range &&
                Number.isInteger(base) &&
                base! >= range[0] &&
                base! <= range[1] &&
                bps ===
                  cycleMovement(
                    base!,
                    tick.category,
                    tick.before,
                    tick.fluctuationBps!,
                  ),
            );
          } else {
            const range = trend.rates[tick.category];
            check(range ? bps >= range[0] && bps <= range[1] : bps === 0);
          }
        }
        multiplier = 1 + bps / 10000;
      } else {
        check(tick.source === undefined || tick.source === "shock");
        const card = allModernMarkets.find(
          (c) => c.id === tick.card && c.category === tick.category,
        );
        check(card);
        check(
          tick.changeBps === undefined ||
            tick.changeBps === Math.round((card.multiplier - 1) * 10000),
        );
        multiplier = card.multiplier;
      }
      if (tick.depression !== undefined)
        check(
          validDepression(tick.depression, tick.round) &&
            tick.round < tick.depression.expires,
        );
      const proposed = nextMarketIndex(tick.before, multiplier);
      const previousDepression = depressionHistory[tick.category];
      if (previousDepression && tick.round < previousDepression.expires)
        check(
          tick.depression?.start === previousDepression.start &&
            tick.depression.expires === previousDepression.expires,
        );
      if (tick.depression) {
        if (!previousDepression || tick.round >= previousDepression.expires)
          check(
            tick.depression.start === tick.round &&
              proposed < 3500 &&
              (!previousDepression || tick.before >= 3500),
          );
        depressionHistory[tick.category] = tick.depression;
      }
      check(
        tick.after === (tick.depression ? Math.min(3499, proposed) : proposed),
      );
      running[tick.category] = tick.after;
      lastId = tick.id;
      lastRound = tick.round;
    }
    check(marketCategories.every((c) => m.indices[c] === running[c]));
    if (m.dynamics !== undefined) {
      const d = m.dynamics;
      check(
        record(d) &&
          d.version === 1 &&
          Number.isInteger(d.startedRound) &&
          d.startedRound >= 1 &&
          d.startedRound <= s.round &&
          Number.isInteger(d.lastRound) &&
          d.lastRound >= d.startedRound &&
          d.lastRound <= s.round &&
          record(d.roundOpen),
      );
      check(d.model === undefined || d.model === 2);
      check(
        marketCategories.every(
          (c) =>
            depressionHistory[c]?.start === d.depressions?.[c]?.start &&
            depressionHistory[c]?.expires === d.depressions?.[c]?.expires,
        ),
      );
      if (d.depressions !== undefined) {
        check(
          record(d.depressions) &&
            Object.entries(d.depressions).every(
              ([category, depression]) =>
                marketCategories.includes(
                  category as (typeof marketCategories)[number],
                ) && validDepression(depression, s.round),
            ),
        );
        for (const category of marketCategories) {
          const depression = d.depressions[category];
          if (depression && s.round < depression.expires)
            check(m.indices[category] < 3500);
        }
      }
      check(
        marketCategories.every(
          (c) =>
            Number.isInteger(d.roundOpen[c]) &&
            d.roundOpen[c] >= 1000 &&
            d.roundOpen[c] <= 50000,
        ),
      );
      if (d.lastRound > d.startedRound) {
        const opening = { stock: 10000, business: 10000, property: 10000 };
        for (const tick of m.history)
          if (tick.round < d.lastRound) opening[tick.category] = tick.after;
        check(marketCategories.every((c) => d.roundOpen[c] === opening[c]));
      }
      check(
        Array.isArray(d.deck) &&
          new Set(d.deck).size === d.deck.length &&
          d.deck.every((id) => marketTrends.some((c) => c.id === id)),
      );
      if (d.active !== null) {
        const a = d.active,
          trend = marketTrends.find((c) => c.id === a?.card);
        check(
          a &&
            trend &&
            Number.isInteger(a.start) &&
            a.start >= 5 &&
            a.start % 5 === 0 &&
            a.start <= d.lastRound &&
            a.expires === a.start + trend.duration &&
            d.lastRound < a.expires,
        );
      }
    }
    for (const p of s.players)
      for (const a of p.assets)
        check(a.boughtRound === undefined || a.boughtRound <= s.round);
  }
  check(
    s.economy &&
      s.economy.version === 1 &&
      Array.isArray(s.economy.active) &&
      Array.isArray(s.economy.deck) &&
      Number.isInteger(s.economy.lastRound) &&
      s.economy.lastRound >= 1 &&
      s.economy.lastRound <= s.round &&
      record(s.economy.principalPaid) &&
      record(s.economy.warned),
  );
  check(
    s.economy.deck.every((id) => economicEvents.some((c) => c.id === id)) &&
      new Set(s.economy.deck).size === s.economy.deck.length,
  );
  check(
    s.economy.active.every(
      (a) =>
        a &&
        economicEvents.some((c) => c.id === a.card) &&
        Number.isInteger(a.start) &&
        a.start >= 1 &&
        a.start <= s.round &&
        a.expires ===
          a.start + economicEvents.find((c) => c.id === a.card)!.duration,
    ),
  );
  for (const records of [s.economy.principalPaid, s.economy.warned])
    check(
      Object.entries(records).every(
        ([id, round]) =>
          ids.includes(id) &&
          Number.isInteger(round) &&
          round >= 1 &&
          round <= s.round,
      ),
    );
  check(
    Array.isArray(s.dice) &&
      s.dice.length <= 3 &&
      s.dice.every((n) => Number.isInteger(n) && n >= 1 && n <= 6),
  );
  if (
    !Array.isArray(s.effects) ||
    !Array.isArray(s.log) ||
    !Array.isArray(s.receipts) ||
    !Array.isArray(s.claimed) ||
    !s.decks ||
    !["small", "large", "market", "expense"].every((k) =>
      Array.isArray(s.decks[k as keyof typeof s.decks]),
    ) ||
    !Array.isArray(s.winners) ||
    !s.dreamVisits ||
    !Number.isInteger(s.sequence)
  )
    throw new Error("This save is missing match history or deck information.");
  if (
    (s.phase === "decision" && !s.decision) ||
    (s.pending &&
      (!s.pending.next ||
        !s.pending.receipt ||
        !Array.isArray(s.pending.fields) ||
        !Array.isArray(s.pending.errors)))
  )
    throw new Error(
      "The pending decision could not be recovered. Choose another save.",
    );
  const deckIds = {
    small: deals.filter((d) => d.tier === "small").map((d) => d.id),
    large: deals.filter((d) => d.tier === "large").map((d) => d.id),
    market: (s.marketState ? allModernMarkets : markets).map((m) => m.id),
    expense: expenses.map((e) => e.id),
  };
  for (const key of ["small", "large", "market", "expense"] as const)
    check(
      s.decks[key].every((id) => deckIds[key].includes(id)) &&
        (key === "market" && s.marketState
          ? s.decks.market.every(
              (id) =>
                s.decks.market.filter((card) => card === id).length <=
                marketCopies(allModernMarkets.find((c) => c.id === id)!),
            )
          : key === "small" && s.smallDeckStage === "early"
            ? s.decks.small.every(
                (id) =>
                  s.decks.small.filter((card) => card === id).length <=
                  smallDealCopies(
                    deals.find((c) => c.id === id)!,
                    true,
                  ),
              )
            : new Set(s.decks[key]).size === s.decks[key].length),
    );
  check(
    s.effects.every(
      (e) =>
        e &&
        (e.kind === "landing" ||
          (e.kind === "payday" &&
            Number.isInteger(e.times) &&
            e.times > 0 &&
            e.times <= 3)),
    ),
  );
  check(
    s.claimed.every((id) =>
      deals.some((d) => d.id === id && d.tier === "fast"),
    ) &&
      s.winners.every((id) => ids.includes(id)) &&
      typeof s.finishReason === "string" &&
      typeof s.tutorialDone === "boolean",
  );
  check(
    record(s.dreamVisits) &&
      Object.entries(s.dreamVisits).every(
        ([id, visits]) =>
          dreams.some((d) => d.id === id) &&
          Array.isArray(visits) &&
          visits.every((id) => ids.includes(id)),
      ),
  );
  check(
    s.log.every(
      (e) =>
        e &&
        Number.isSafeInteger(e.id) &&
        Number.isInteger(e.round) &&
        typeof e.player === "string" &&
        typeof e.text === "string" &&
        ["neutral", "positive", "negative"].includes(e.tone),
    ),
  );
  s.receipts.forEach((r) => validReceipt(r, ids));
  const d = s.decision;
  if (d) {
    if (d.kind === "opportunity")
      check(
        index(d.owner) &&
          typeof d.transferred === "boolean" &&
          (!d.card || deals.some((c) => c.id === d.card)) &&
          (!d.tier || ["small", "large"].includes(d.tier)),
      );
    else if (d.kind === "market")
      check(
        !!marketById(d.card) &&
          deckIds.market.includes(d.card) &&
          index(d.responder) &&
          Array.isArray(d.remaining) &&
          d.remaining.every(index),
      );
    else if (d.kind === "discount") {
      const market = marketById(d.market);
      check(
        s.marketState &&
          market &&
          deckIds.market.includes(d.market) &&
          discountCandidates(s, market.category).some((c) => c.id === d.card) &&
          index(d.responder) &&
          Array.isArray(d.remaining) &&
          d.remaining.every(index),
      );
      const queue = [d.responder, ...d.remaining];
      check(
        new Set(queue).size === queue.length &&
          queue.every(
            (i) =>
              !s.players[i].eliminated &&
              !s.players[i].bankrupt &&
              !s.players[i].skip,
          ),
      );
    } else if (d.kind === "dream") check(dreams.some((c) => c.id === d.id));
    else if (d.kind === "insolvency")
      check(
        isMoney(d.amount) &&
          d.amount >= 0 &&
          typeof d.title === "string" &&
          (d.principal === undefined || typeof d.principal === "boolean"),
      );
    else if (d.kind === "liquidity") check(["roll", "end"].includes(d.resume));
    else check(d.kind === "charity");
    check(s.phase === "decision");
  }
  if (s.pending) {
    const pending = s.pending;
    if (
      d?.kind === "discount" &&
      pending.receipt.title.startsWith("Discount purchase: ")
    )
      check(pending.completeDiscount === true);
    if (pending.completeDiscount !== undefined) {
      check(
        pending.completeDiscount === true &&
          d?.kind === "discount" &&
          s.players[d.responder].human &&
          pending.receipt.title.startsWith(
            `Discount purchase: ${deals.find((c) => c.id === d.card)!.name}`,
          ) &&
          pending.next.assets.some(
            (a) =>
              a.cardId === d.card &&
              !s.players[0].assets.some((before) => before.id === a.id),
          ),
      );
    }
    validPlayer(pending.next);
    pending.next.assets.forEach((a) =>
      check(!a.listing || a.listing.listedRound <= s.round),
    );
    validBargainBuys(pending.next, s.round);
    if (s.marketState)
      for (const a of pending.next.assets)
        check(a.boughtRound === undefined || a.boughtRound <= s.round);
    validReceipt(pending.receipt, ids);
    check(
      pending.next.id === s.players[0].id &&
        pending.receipt.player === s.players[0].id,
    );
    const before = playerFinancials(s, s.players[0]),
      after = playerFinancials(s, pending.next);
    check(
      financialKeys.every(
        (k) =>
          pending.receipt.before[k] === before[k] &&
          pending.receipt.after[k] === after[k],
      ),
    );
    check(
      pending.fields.length > 0 &&
        new Set(pending.fields).size === pending.fields.length &&
        pending.fields.every((k) => worksheetKeys.includes(k)) &&
        worksheetKeys.every(
          (k) => pending.fields.includes(k) === (before[k] !== after[k]),
        ) &&
        pending.errors.every((k) =>
          pending.fields.includes(k as AccountingField),
        ),
    );
    pending.values ??= {};
    check(
      record(pending.values) &&
        Object.entries(pending.values).every(
          ([k, v]) =>
            pending.fields.includes(k as AccountingField) &&
            typeof v === "string" &&
            v.length <= 40,
        ),
    );
  }
  // Only saves from before the review feature may omit these fields together.
  // A partially missing review must not silently discard an unread summary.
  const reviewFields = [
    s.history,
    s.historyStartRound,
    s.notices,
    s.turnContext,
  ];
  check(
    reviewFields.every((v) => v === undefined) ||
      reviewFields.every((v) => v !== undefined),
  );
  initializeReview(s);
  check(
    s.players.every((p) => !p.elimination || p.elimination.round <= s.round),
  );
  const strings = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((t) => typeof t === "string");
  check(
    Number.isInteger(s.historyStartRound) &&
      s.historyStartRound >= 1 &&
      s.historyStartRound <= s.round &&
      Array.isArray(s.history) &&
      Array.isArray(s.notices),
  );
  check(
    s.history.every(
      (h) =>
        h &&
        Number.isSafeInteger(h.id) &&
        h.id > 0 &&
        h.id <= s.sequence &&
        Number.isInteger(h.round) &&
        h.round >= s.historyStartRound &&
        h.round <= s.round &&
        ids.includes(h.player) &&
        ["start", "transaction", "decision", "finish"].includes(h.kind) &&
        typeof h.title === "string" &&
        typeof h.note === "string" &&
        validFinancial(h.values) &&
        record(h.delta) &&
        Object.entries(h.delta).every(
          ([key, value]) =>
            financialKeys.includes(key as keyof Financials) && isMoney(value),
        ) &&
        (!h.opportunity ||
          (isMoney(h.opportunity.down) &&
            h.opportunity.down > 0 &&
            isMoney(h.opportunity.income) &&
            typeof h.opportunity.affordable === "boolean")),
    ),
  );
  check(new Set(s.history.map((h) => h.id)).size === s.history.length);
  check(
    ids.every((id) =>
      s.history.some((h) => h.player === id && h.kind === "start"),
    ),
  );
  check(
    s.notices.every(
      (n) =>
        n &&
        Number.isSafeInteger(n.id) &&
        n.id > 0 &&
        n.id <= s.sequence &&
        ["event", "npc-turn", "cycle", "risk"].includes(n.kind) &&
        (n.tone === undefined ||
          ["positive", "negative", "neutral"].includes(n.tone)) &&
        (n.eventId === undefined ||
          [...economicEvents, ...marketTrends].some(
            (c) => c.id === n.eventId,
          )) &&
        ids.includes(n.player) &&
        Number.isInteger(n.round) &&
        n.round >= 1 &&
        n.round <= s.round &&
        typeof n.title === "string" &&
        typeof n.description === "string" &&
        strings(n.events) &&
        strings(n.reasons) &&
        Array.isArray(n.dice) &&
        n.dice.every((d) => Number.isInteger(d) && d >= 1 && d <= 6) &&
        Array.isArray(n.changes) &&
        n.changes.every(
          (c) =>
            c &&
            ids.includes(c.player) &&
            validFinancial(c.before) &&
            validFinancial(c.after),
        ),
    ),
  );
  check(new Set(s.notices.map((n) => n.id)).size === s.notices.length);
  if (s.turnContext)
    check(
      ids.includes(s.turnContext.player) &&
        Number.isInteger(s.turnContext.round) &&
        s.turnContext.round >= 1 &&
        s.turnContext.round <= s.round &&
        strings(s.turnContext.events) &&
        strings(s.turnContext.reasons) &&
        Array.isArray(s.turnContext.dice) &&
        s.turnContext.dice.every(
          (d) => Number.isInteger(d) && d >= 1 && d <= 6,
        ) &&
        Array.isArray(s.turnContext.before) &&
        s.turnContext.before.every(
          (v) => v && ids.includes(v.player) && validFinancial(v.values),
        ),
    );
  initializeMarketDynamics(s);
  return s;
}
export function saveGame(state: GameState, slot = "auto", name = "Autosave") {
  const record: SaveRecord = { name, savedAt: new Date().toISOString(), state };
  localStorage.setItem(PREFIX + slot, JSON.stringify(record));
}
export function loadGame(slot = "auto"): SaveRecord | null {
  const raw = localStorage.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (typeof value.name !== "string" || typeof value.savedAt !== "string")
      throw new Error();
    return { ...value, state: validateSave(value.state) };
  } catch (e) {
    throw new Error(
      e instanceof Error && !(e instanceof TypeError) && e.message.length > 25
        ? e.message
        : "This save could not be read. Your other saves have not been changed.",
    );
  }
}
export function saveInfo(
  slot: string,
): { name: string; savedAt: string; round: number; damaged?: boolean } | null {
  try {
    const raw = localStorage.getItem(PREFIX + slot);
    if (!raw) return null;
    const r = JSON.parse(raw);
    return { name: r.name, savedAt: r.savedAt, round: r.state.round };
  } catch {
    return { name: "Unreadable save", savedAt: "", round: 0, damaged: true };
  }
}
