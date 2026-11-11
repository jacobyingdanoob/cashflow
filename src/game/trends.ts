import type { AssetCategory, GameState, MarketTrend } from "./types";
export const TREND_INTERVAL = 5;
export const TREND_DURATION = 3;
const source = {
  label: "FRED economic data",
  url: "https://fred.stlouisfed.org/",
};
const definitions: [
  string,
  string,
  MarketTrend["tone"],
  MarketTrend["rates"],
  string,
][] = [
  [
    "stock-boom",
    "Stock boom",
    "positive",
    { stock: [300, 400] },
    "Strong earnings and renewed investor confidence can sustain an equity rally.",
  ],
  [
    "stock-correction",
    "Stock correction",
    "negative",
    { stock: [-500, -350] },
    "Risk aversion and weaker earnings can drive several consecutive rounds of selling.",
  ],
  [
    "housing-demand",
    "Housing demand boom",
    "positive",
    { property: [100, 175] },
    "Housing shortages and easier financing support real-estate prices.",
  ],
  [
    "housing-credit",
    "Housing credit crunch",
    "negative",
    { property: [-250, -150] },
    "Tighter lending reduces buyer demand while existing mortgages remain due.",
  ],
  [
    "business-expansion",
    "Main Street expansion",
    "positive",
    { business: [250, 350] },
    "Stronger customer spending raises business valuations and operating income.",
  ],
  [
    "business-recession",
    "Main Street recession",
    "negative",
    { business: [-400, -250] },
    "Falling consumer spending puts sustained pressure on small businesses.",
  ],
  [
    "credit-easing",
    "Credit confidence returns",
    "positive",
    { stock: [325, 425], business: [200, 300], property: [75, 125] },
    "Improving credit conditions can lift demand across asset markets.",
  ],
  [
    "risk-off",
    "Broad risk-off downturn",
    "negative",
    { stock: [-650, -450], business: [-400, -250], property: [-200, -100] },
    "Deleveraging can depress several markets at once, without reducing debt principal.",
  ],
  [
    "productivity",
    "Productivity wave",
    "positive",
    { stock: [350, 450], business: [250, 325] },
    "New technology and improved margins lift equity and business expectations.",
  ],
  [
    "cost-squeeze",
    "Inflation squeeze",
    "negative",
    { stock: [-450, -325], business: [-350, -225] },
    "Higher input costs weigh on earnings and business valuations.",
  ],
  [
    "neighborhood-renewal",
    "Neighborhood renewal",
    "positive",
    { property: [125, 200], business: [225, 300] },
    "Local investment draws residents and customers to a neighborhood.",
  ],
  [
    "demand-slowdown",
    "Demand slowdown",
    "negative",
    { property: [-175, -100], business: [-325, -225] },
    "Households delay large purchases and reduce discretionary spending.",
  ],
];
export const marketTrends: MarketTrend[] = definitions.map(
  ([id, name, tone, rates, scenario]) => ({
    id: `trend-${id}`,
    name,
    tone,
    rates,
    scenario,
    source,
    duration: TREND_DURATION,
    description:
      "A sustained economic cycle acts for three rounds. Its baseline is adjusted toward 100% when prices are unusually high or low, and can reverse direction at extremes. Ordinary fluctuations continue in every market. Combined cycle movements are stronger than ordinary noise and capped at 14% per round, below the smallest 15% market-space shock. Changes compound without resetting at expiry.",
  }),
);
export function initializeMarketDynamics(s: GameState) {
  if (!s.marketState) return;
  if (s.marketState.dynamics) {
    s.marketState.dynamics.model ??= 2;
    s.marketState.dynamics.depressions ??= {};
    return;
  }
  // Upgrade older persistent-market saves without repricing holdings or using RNG.
  // The next market draw starts the new weighted shock deck.
  s.decks.market = [];
  s.config.economicCycles = true;
  s.marketState.dynamics = {
    version: 1,
    model: 2,
    depressions: {},
    startedRound: s.round,
    lastRound: s.round,
    roundOpen: { ...s.marketState.indices },
    deck: [],
    active: null,
  };
}
export function cycleRange(
  card: MarketTrend,
  category: AssetCategory,
): [number, number] | undefined {
  const original = card.rates[category];
  if (!original) return undefined;
  const floor = { property: 300, business: 450, stock: 650 }[category];
  const ceiling = { property: 650, business: 800, stock: 950 }[category];
  const scale = category === "property" ? 3 : 2;
  const adjust = (n: number) =>
    Math.sign(n) * Math.max(floor, Math.min(ceiling, Math.abs(n) * scale));
  return [adjust(original[0]), adjust(original[1])];
}
export function cycleMovement(
  base: number,
  category: AssetCategory,
  index: number,
  fluctuation: number,
) {
  const floor = { property: 300, business: 450, stock: 650 }[category];
  const pull = Math.max(
    -900,
    Math.min(900, Math.round((10000 - index) * 0.12)),
  );
  let cycle = base + pull;
  if (Math.abs(cycle) < floor)
    cycle =
      (Math.abs(index - 10000) >= 2500
        ? Math.sign(10000 - index)
        : Math.sign(base)) * floor;
  cycle = Math.max(-1100, Math.min(1100, cycle));
  const total = cycle + fluctuation;
  const minTotal =
    category === "stock" ? 500 : category === "business" ? 300 : 200;
  return Math.sign(cycle) * Math.max(minTotal, Math.min(1400, Math.abs(total)));
}
export function activeDepression(s: GameState, category: AssetCategory) {
  const d = s.marketState?.dynamics?.depressions?.[category];
  return d && d.start <= s.round && s.round < d.expires ? d : null;
}
export const trendRate = (range: [number, number]) => {
  const format = (n: number) => `${n > 0 ? "+" : ""}${(n / 100).toFixed(2)}%`;
  return `${format(range[0])} to ${format(range[1])} per round`;
};
export function activeMarketTrend(s: GameState) {
  const active = s.marketState?.dynamics?.active;
  return active && active.start <= s.round && s.round < active.expires
    ? { ...active, definition: marketTrends.find((c) => c.id === active.card)! }
    : null;
}
export function roundMarketChange(s: GameState, category: AssetCategory) {
  const open = s.marketState?.dynamics?.roundOpen[category] ?? 10000;
  return ((s.marketState?.indices[category] ?? open) / open - 1) * 100;
}
