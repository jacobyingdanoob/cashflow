import {
  deals,
  dreams,
  expenses,
  innerBoard,
  markets,
  outerBoard,
  professions,
  smallDealCopies,
} from "./content";
import { createGame, initializeReview, playerFinancials } from "./engine";
import { economicEvents, initializeEconomy } from "./economy";
import type {
  AccountingField,
  Financials,
  GameState,
  Player,
  Receipt,
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
        ["home", "school", "car", "credit", "retail", "bank"].includes(
          d.kind,
        ) &&
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
  if (s.config.roleDifficulty === undefined)
    s.config.roleDifficulty =
      professions.find((p) => p.id === s.players?.[0]?.profession)
        ?.difficulty ?? "standard";
  if (s.roleRevealed === undefined) s.roleRevealed = true;
  check(typeof s.roleRevealed === "boolean");
  if (s.personalReviewSeen === undefined) s.personalReviewSeen = false;
  check(typeof s.personalReviewSeen === "boolean");
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
  const ids = s.players.map((p) => p.id),
    index = (n: number) =>
      Number.isInteger(n) && n >= 0 && n < s.players.length;
  check(new Set(ids).size === ids.length);
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
    market: markets.map((m) => m.id),
    expense: expenses.map((e) => e.id),
  };
  for (const key of ["small", "large", "market", "expense"] as const)
    check(
      s.decks[key].every((id) => deckIds[key].includes(id)) &&
        (key === "small" && s.smallDeckStage === "early"
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
        markets.some((c) => c.id === d.card) &&
          index(d.responder) &&
          Array.isArray(d.remaining) &&
          d.remaining.every(index),
      );
    else if (d.kind === "dream") check(dreams.some((c) => c.id === d.id));
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
    validPlayer(pending.next);
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
          economicEvents.some((c) => c.id === n.eventId)) &&
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
