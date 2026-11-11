import type {
  Asset,
  AssetCategory,
  Deal,
  GameState,
  MarketCard,
  PersistentMarkets,
  SaleQuote,
  Player,
} from "./types";

export const marketCategories: AssetCategory[] = [
  "stock",
  "property",
  "business",
];
export const marketLabels: Record<AssetCategory, string> = {
  stock: "Stocks",
  property: "Real estate",
  business: "Businesses",
};
export const ACQUISITION_RATE = 0.05;
export const SELLING_RATE = 0.1;
export const CAPITAL_GAINS_RATE = 0.2;
export const EARLY_SALE_ROUNDS = 10;
export const nextMarketIndex = (before: number, multiplier: number) =>
  Math.max(1000, Math.min(50000, Math.round(before * multiplier)));
export function initialMarkets(): PersistentMarkets {
  return {
    version: 1,
    indices: { stock: 10000, property: 10000, business: 10000 },
    history: [],
    dynamics: {
      version: 1,
      model: 2,
      depressions: {},
      startedRound: 1,
      lastRound: 1,
      roundOpen: { stock: 10000, property: 10000, business: 10000 },
      deck: [],
      active: null,
    },
  };
}
export function marketIndex(s: GameState | undefined, category: AssetCategory) {
  return (s?.marketState?.indices[category] ?? 10000) / 10000;
}
export function marketFactor(
  s: GameState | undefined,
  key: "values" | "income" | "loanPayments",
  category?: AssetCategory,
) {
  if (!s?.marketState || !category || key === "loanPayments") return 1;
  const index = marketIndex(s, category);
  return key === "values"
    ? index
    : category === "property"
      ? 1
      : Math.max(0.1, 1 + (index - 1) * 0.25);
}
export const opportunityType = (c: Pick<Deal, "category" | "mortgage">) =>
  c.category === "stock" ? 3 : c.mortgage > 0 ? 1 : 2;
type PurchaseState = Pick<GameState, "marketState"> &
  Partial<Pick<GameState, "players" | "current" | "decision" | "history">>;
export function type1PurchaseCount(s: PurchaseState | undefined, p?: Player) {
  if (!p) return 0;
  if (p.type1Purchases !== undefined) return p.type1Purchases;
  // Older saves retain all purchases in history, including holdings since sold.
  const recorded =
    s?.history?.filter(
      (h) =>
        h.player === p.id &&
        h.kind === "transaction" &&
        /^(Bought |Discount purchase: |Accepted )/.test(h.title) &&
        (h.delta.debt ?? 0) > 0 &&
        (h.delta.assets ?? 0) > 0,
    ).length ?? 0;
  return Math.max(
    recorded,
    p.assets.filter((a) => a.mortgage > 0 || !!a.financingBasis).length,
  );
}
export function purchaseQuote(
  s: PurchaseState | undefined,
  c: Deal,
  count = 1,
  outright = false,
  owner?: Player,
) {
  const responder =
    s?.decision?.kind === "discount" || s?.decision?.kind === "market"
      ? s.decision.responder
      : s?.current;
  const p = owner ?? s?.players?.[responder ?? 0];
  const tier = type1PurchaseCount(s, p) + 1;
  const downRate = [0.1, 0.15, 0.2, 0.25, 0.35][Math.min(4, tier - 1)];
  const financed = !!s?.marketState && opportunityType(c) === 1 && !outright;
  const unitDown = outright
    ? c.cost
    : financed
      ? Math.round(c.cost * downRate)
      : c.down;
  const unitMortgage = outright ? 0 : financed ? c.cost - unitDown : c.mortgage;
  const unitFinancing =
    c.mortgage > 0 ? Math.round((c.financing * unitMortgage) / c.mortgage) : 0;
  const deal = {
    ...c,
    down: unitDown,
    mortgage: unitMortgage,
    financing: unitFinancing,
    income: c.income + c.financing - unitFinancing,
  };
  const price = c.cost * count,
    down = unitDown * count,
    fee =
      s?.marketState && c.category !== "stock"
        ? Math.round(price * ACQUISITION_RATE)
        : 0;
  return {
    deal,
    count,
    tier,
    downRate,
    price,
    down,
    fee,
    cash: down + fee,
    mortgage: unitMortgage * count,
  };
}
export function saleQuote(s: GameState, a: Asset, gross: number): SaleQuote {
  const modern = !!s.marketState,
    fee =
      modern && a.category !== "stock" ? Math.round(gross * SELLING_RATE) : 0,
    penalty =
      modern &&
      a.mortgage > 0 &&
      a.boughtRound !== undefined &&
      s.round - a.boughtRound < EARLY_SALE_ROUNDS
        ? a.financing * 2
        : 0,
    taxableProfit = Math.max(
      0,
      gross - fee - penalty - a.cost - (a.acquisitionFee ?? 0),
    ),
    tax = modern ? Math.round(taxableProfit * CAPITAL_GAINS_RATE) : 0;
  return {
    gross,
    fee,
    penalty,
    taxableProfit,
    tax,
    mortgage: a.mortgage,
    net: gross - fee - penalty - tax - a.mortgage,
  };
}
const movements = [
  ["Credit tightens", -15],
  ["Fresh demand", 8],
  ["Confidence builds", 15],
  ["Buyers pull back", -8],
  ["Steady expansion", 5],
  ["Risk-off sell-off", -25],
  ["Recovery rally", 25],
  ["Profit-taking", -5],
] as const;
export const modernMarkets: MarketCard[] = marketCategories.flatMap(
  (category) =>
    movements.map(([title, percent], i) => ({
      id: `pulse-${category}-${i}`,
      name: `${marketLabels[category]} · ${title}`,
      description: `${marketLabels[category]} prices move ${percent > 0 ? "+" : ""}${percent}%. The new price persists until another event changes this market.${category === "property" ? " Existing rent is unchanged." : " Operating income changes by one quarter of the percentage move in the index from its starting level."} Every eligible owner may sell or hold.`,
      category,
      multiplier: 1 + percent / 100,
      effect: "offer",
      amount: 0,
    })),
);
const shockSizes = [15, 20, 30, 40, 50];
const shockWeights = [10, 6, 3, 2, 1];
export const marketShocks: MarketCard[] = marketCategories.flatMap((category) =>
  shockSizes.flatMap((size) =>
    [-1, 1].map((sign) => ({
      id: `shock-${category}-${sign < 0 ? "down" : "up"}-${size}`,
      name: `${marketLabels[category]} · ${sign < 0 ? "Sell-off" : "Rally"} ${size}%`,
      description: `An immediate ${sign < 0 ? "−" : "+"}${size}% shock reprices ${marketLabels[category].toLowerCase()}. Larger shocks appear less often. Every eligible owner may sell or hold. The price change compounds with round-by-round market trends and does not expire.`,
      category,
      multiplier: 1 + (sign * size) / 100,
      effect: "offer" as const,
      amount: 0,
    })),
  ),
);
export const marketCopies = (card: MarketCard) =>
  card.id.startsWith("shock-")
    ? shockWeights[
        shockSizes.indexOf(Math.round(Math.abs(card.multiplier - 1) * 100))
      ]
    : 1;
export const allModernMarkets = [...modernMarkets, ...marketShocks];
