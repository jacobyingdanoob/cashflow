import type {
  Deal,
  Dream,
  ExpenseCard,
  GameConfig,
  MarketCard,
  Player,
  Space,
} from "./types";
import {
  encyclopediaSmallDeals,
  encyclopediaLargeDeals,
  encyclopediaMarkets,
  encyclopediaExpenses,
} from "./encyclopedia";
export const dollars = (n: number) => Math.round(n * 100);
export const EARLY_OPPORTUNITY_ROUNDS = 10;
export const EARLY_OPPORTUNITY_WEIGHT = 3;
export const smallDealCopies = (card: Deal, early: boolean) =>
  early &&
  card.tier === "small" &&
  (card.category === "stock" ||
    (card.category === "business" &&
      card.mortgage === 0 &&
      card.financing === 0))
    ? EARLY_OPPORTUNITY_WEIGHT
    : 1;
export { professions } from "./roles";
// All property/business income is NET of the stated financing payment.
// A mortgage payoff adds that financing payment back to net income.
function property(
  id: string,
  name: string,
  cost: number,
  down: number,
  income: number,
  tier: Deal["tier"],
  description: string,
  transferable = false,
): Deal {
  const mortgage = cost - down;
  return {
    id,
    name,
    description,
    category: "property",
    cost: dollars(cost),
    down: dollars(down),
    mortgage: dollars(mortgage),
    income: dollars(income),
    financing: dollars(Math.round(mortgage * 0.006)),
    unitPrice: 0,
    transferable,
    tier,
    distress: dollars(down / 2),
  };
}
function business(
  id: string,
  name: string,
  down: number,
  income: number,
  tier: Deal["tier"],
  description: string,
  transferable = false,
): Deal {
  return {
    id,
    name,
    description,
    category: "business",
    cost: dollars(down),
    down: dollars(down),
    mortgage: 0,
    income: dollars(income),
    financing: 0,
    unitPrice: 0,
    transferable,
    tier,
    distress: dollars(down / 2),
  };
}
const smallProperties = [
  "Garden studio",
  "Riverside condo",
  "Station apartment",
  "Maple Street duplex",
  "Courtyard flat",
  "University rental",
  "Corner shop unit",
  "Harbor loft",
];
const smallBusinesses = [
  "Coffee cart partnership",
  "Neighborhood laundry",
  "Vending machine route",
  "Bike-share station",
  "Community storage",
  "Digital template shop",
  "Weekend market stall",
  "Print studio share",
];
export const smallDeals: Deal[] = [
  ...smallProperties.map((name, i) =>
    property(
      `sp${i}`,
      name,
      65000 + i * 9500,
      3000 + i * 550,
      105 + i * 24,
      "small",
      "A modest rental with an established tenant. Monthly cash flow is after financing and operating costs.",
      i % 3 === 0,
    ),
  ),
  ...smallBusinesses.map((name, i) =>
    business(
      `sb${i}`,
      name,
      1700 + i * 450,
      65 + i * 18,
      "small",
      "An owner-operated local venture offers a passive revenue share. Returns vary with market events.",
      i % 3 === 0,
    ),
  ),
  ...[
    "Northstar Utilities",
    "Cedar Index Fund",
    "Evergreen Health",
    "Metro Logistics",
    "Sunfield Energy",
    "Harbor Income Fund",
    "Common Ground REIT",
    "Atlas Essentials",
  ].map((name, i): Deal => ({
    id: `ss${i}`,
    name,
    description:
      "Buy shares at the quoted price. Future market cards may offer a sale, split, or special distribution.",
    category: "stock",
    cost: dollars(15 + i * 5),
    down: dollars(15 + i * 5),
    mortgage: 0,
    income: dollars(0.12 + i * 0.04),
    financing: 0,
    unitPrice: dollars(15 + i * 5),
    transferable: false,
    tier: "small",
    distress: dollars((15 + i * 5) / 2),
  })),
  ...encyclopediaSmallDeals,
];
export const largeDeals: Deal[] = [
  ...[
    "Oakwood fourplex",
    "Canal-side apartments",
    "Railway workers housing",
    "Garden terrace homes",
    "Eastside sixplex",
    "Parkview residences",
    "Foundry live-work units",
    "Elm Street apartments",
    "Lakeshore courtyard",
    "Midtown mixed-use",
  ].map((name, i) =>
    property(
      `lp${i}`,
      name,
      145000 + i * 27000,
      8500 + i * 2400,
      360 + i * 95,
      "large",
      "A larger property with established leases. Quoted cash flow is net of mortgage payments and operating costs.",
      i % 3 === 0,
    ),
  ),
  ...[
    "Self-service car wash",
    "Local parcel lockers",
    "Solar roof partnership",
    "Neighborhood mini-storage",
    "After-school center",
    "Equipment rental company",
    "Community gym share",
    "Managed coworking floor",
  ].map((name, i) =>
    business(
      `lb${i}`,
      name,
      6500 + i * 3200,
      245 + i * 115,
      "large",
      "A managed business with a revenue-sharing agreement. A bigger commitment with recurring income.",
      i % 2 === 0,
    ),
  ),
  ...encyclopediaLargeDeals,
];
export const fastDeals: Deal[] = [
  "City storage network",
  "Westbank apartment block",
  "Regional laundry group",
  "Urban solar cooperative",
  "Riverside medical suites",
  "Neighborhood market hall",
  "Light industrial campus",
  "Community energy network",
  "Transit retail portfolio",
  "Independent hotel group",
  "Creative studios campus",
  "Last-mile logistics hub",
].map((name, i) =>
  i % 2
    ? property(
        `ft${i}`,
        name,
        380000 + i * 55000,
        34000 + i * 6000,
        1050 + i * 240,
        "fast",
        "A city-scale property opportunity. Your existing finances continue; cash flow is net of financing.",
      )
    : business(
        `ft${i}`,
        name,
        26000 + i * 6500,
        900 + i * 220,
        "fast",
        "An established regional business. Buying claims this opportunity exclusively for your portfolio.",
      ),
);
export const deals = [...smallDeals, ...largeDeals, ...fastDeals];
const marketNames = [
  "A growing neighborhood",
  "New employers arrive",
  "Investor interest",
  "A fresh valuation",
  "Local demand rises",
  "A buyer comes calling",
  "Changing city rhythms",
  "An unexpected offer",
];
export const markets: MarketCard[] = [
  ...Array.from({ length: 24 }, (_, i): MarketCard => ({
    id: `m${i}`,
    name: marketNames[Math.floor(i / 3)],
    description:
      i === 20
        ? "Shareholders receive a two-for-one split; total holdings and income are unchanged."
        : i === 23
          ? "A special cash distribution rewards current shareholders."
          : "An outside buyer offers a new price for eligible holdings. Every owner may choose whether to sell.",
    category: (["property", "business", "stock"] as const)[i % 3],
    multiplier: [0.82, 1.05, 1.25, 1.45, 0.95, 1.6, 1.15, 1.35][
      Math.floor(i / 3)
    ],
    effect: i === 20 ? "split" : i === 23 ? "dividend" : "offer",
    amount: i === 23 ? dollars(2) : 0,
  })),
  ...encyclopediaMarkets,
];
const expenseData: [string, number, string][] = [
  ["A leaky roof", 850, "A repair today keeps a bigger problem away."],
  ["Car trouble", 620, "Your car needs an unexpected visit to the mechanic."],
  ["Dental visit", 380, "A necessary appointment beyond your insurance cover."],
  ["A new laptop", 1100, "Your everyday workhorse has finally retired."],
  ["Family celebration", 450, "Some moments deserve to be celebrated."],
  [
    "Appliance replacement",
    700,
    "The refrigerator has other plans this month.",
  ],
  ["Vet appointment", 280, "A little extra care for a four-legged friend."],
  ["Weekend getaway", 520, "A change of scenery comes with a price."],
  ["Phone replacement", 350, "An unfortunate encounter with the pavement."],
  [
    "Home insurance excess",
    900,
    "A small accident triggers your insurance excess.",
  ],
  ["Annual subscriptions", 160, "All those little renewals add up."],
  ["Emergency travel", 750, "Family needs you a little sooner than expected."],
  ["Heating repair", 480, "Keep your home comfortable through winter."],
  ["Bicycle replacement", 240, "Your daily ride needs replacing."],
  ["Community fundraiser", 180, "A mandatory neighborhood association levy."],
  ["Parking mishap", 120, "A lesson in reading the signs."],
  ["New work clothes", 260, "A refresh for your professional wardrobe."],
  ["Water damage", 1300, "A burst pipe requires immediate repairs."],
  ["School supplies", 220, "Help with the family education budget."],
  ["Moving costs", 950, "A necessary change of address."],
  ["Medical copayment", 560, "An unexpected clinic visit."],
  ["Home maintenance", 340, "Small repairs keep the household running."],
  ["Internet equipment", 190, "A reliable connection needs new equipment."],
  ["Family support", 680, "An unplanned contribution to a loved one."],
];
export const expenses: ExpenseCard[] = expenseData.map(
  ([name, cost, description], i) => ({
    id: `e${i}`,
    name,
    cost: dollars(cost),
    description,
  }),
);
expenses.push(...encyclopediaExpenses);
export const dreams: Dream[] = [
  [
    "coast",
    "A home by the sea",
    "Open the windows. Listen to the ocean.",
    150000,
    "sun",
  ],
  [
    "travel",
    "A year around the world",
    "Collect stories, not just stamps.",
    100000,
    "globe",
  ],
  [
    "studio",
    "Your creative studio",
    "Make room for the work you love.",
    125000,
    "palette",
  ],
  [
    "forest",
    "A cabin in the forest",
    "A quieter life, on your own terms.",
    130000,
    "tree",
  ],
  [
    "foundation",
    "A community foundation",
    "Turn your freedom into opportunity for others.",
    180000,
    "heart",
  ],
  [
    "sailing",
    "An ocean adventure",
    "Let curiosity set your course.",
    160000,
    "sail",
  ],
  [
    "farm",
    "A little countryside farm",
    "More open space. A little less rush.",
    140000,
    "leaf",
  ],
  [
    "time",
    "A year to call your own",
    "Time with the people who matter most.",
    90000,
    "coffee",
  ],
].map(([id, name, description, cost, icon]) => ({
  id: String(id),
  name: String(name),
  description: String(description),
  cost: dollars(Number(cost)),
  icon: String(icon),
}));
export const innerBoard: Space[] = [
  "payday",
  "opportunity",
  "market",
  "opportunity",
  "expense",
  "charity",
  "opportunity",
  "baby",
  "payday",
  "opportunity",
  "market",
  "expense",
  "opportunity",
  "downsized",
  "opportunity",
  "market",
  "payday",
  "opportunity",
  "expense",
  "opportunity",
  "market",
  "charity",
  "opportunity",
  "expense",
].map((kind) => ({
  kind: kind as Space["kind"],
  label: (
    {
      payday: "Payday",
      opportunity: "Opportunity",
      market: "Market",
      expense: "Life happens",
      charity: "Give back",
      baby: "New arrival",
      downsized: "Downsized",
    } as Record<string, string>
  )[kind],
}));
export const outerBoard: Space[] = Array.from({ length: 32 }, (_, i) => {
  if (i % 8 === 0) return { kind: "payday", label: "Payday" };
  if (i % 4 === 2) {
    const d = dreams[Math.floor(i / 4)];
    return { kind: "dream", label: d.name, content: d.id };
  }
  if (i % 2 === 1) {
    const d = fastDeals[Math.floor(i / 2) % 12];
    return { kind: "business", label: d.name, content: d.id };
  }
  return (
    (
      {
        4: { kind: "market", label: "Market" },
        12: { kind: "charity", label: "Give back" },
        20: { kind: "audit", label: "Tax audit" },
        28: { kind: "lawsuit", label: "Lawsuit" },
      } as Record<number, Space>
    )[i] ?? { kind: "expense", label: "Life happens" }
  );
});
// Keep all twelve businesses represented; final four odd spaces are life events.
outerBoard[25] = { kind: "expense", label: "Life happens" };
outerBoard[27] = { kind: "market", label: "Market" };
outerBoard[29] = { kind: "divorce", label: "Divorce" };
outerBoard[31] = { kind: "opportunity", label: "Opportunity" };
// Keep the 32 positions stable. Unused dream slots become opportunities.
// Include eliminated seats so players never move when someone leaves the game.
export function fastTrackBoard(players: Pick<Player, "dream">[]): Space[] {
  const selected = [...new Set(players.map((p) => p.dream))],
    slots = outerBoard.flatMap((s, i) => (s.kind === "dream" ? [i] : [])),
    placed = new Map(
      selected.map((id, i) => [
        slots[Math.floor((i * slots.length) / selected.length)],
        dreams.find((d) => d.id === id)!,
      ]),
    );
  return outerBoard.map((space, i) => {
    if (space.kind !== "dream") return space;
    const dream = placed.get(i);
    return dream
      ? { kind: "dream", label: dream.name, content: dream.id }
      : { kind: "opportunity", label: "Opportunity" };
  });
}
export const DEFAULT_CONFIG: GameConfig = {
  liquidityRisk: true,
  principalRate: 0,
  economicCycles: true,
  opponents: 3,
  profession: "random",
  roleDifficulty: "standard",
  adaptedCards: false,
  startingCash: 1,
  livingExpenses: 1,
  annualRate: 12,
  victory: "full",
  incomeGoal: dollars(5000),
  dreamMultiplier: 1,
  roundLimit: 0,
  difficulty: "standard",
  accounting: "auto",
  speed: "fast",
  seed: 20261103,
  dream: "coast",
};
export const profileNames = {
  cautious: "The careful planner",
  income: "The income builder",
  bold: "The calculated risk-taker",
  diverse: "The balanced investor",
};
