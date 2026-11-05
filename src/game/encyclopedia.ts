import type { CardSource, Deal, ExpenseCard, MarketCard } from "./types";

// Versioned, locally stored adaptations of the public card tables. No runtime
// requests are made to the source site. Descriptions below are written for this game.
export const ENCYCLOPEDIA_VERSION = 1;
const cents = (n: number) => Math.round(n * 100);
const source = (section: string, adaptation: string): CardSource => ({
  label: "Cash Flow Lifestyle card encyclopedia",
  url: `https://cashflow.lifestyle/encyclopedia/${section}/`,
  adaptation,
});
const investmentSource = (section: string) =>
  source(
    section,
    "Source prices, down payments, and operating income; financing uses this game’s 0.6% monthly payment basis. Displayed passive income is after financing, which is never deducted twice. Partial repayments reduce financing proportionally.",
  );
const financed = (
  id: string,
  name: string,
  category: "property" | "business",
  cost: number,
  down: number,
  operatingIncome: number,
  tier: "small" | "large",
): Deal => {
  const mortgage = cents(cost - down),
    financing = cents(Math.round((cost - down) * 0.006));
  return {
    id,
    name,
    category,
    tier,
    cost: cents(cost),
    down: cents(down),
    mortgage,
    income: cents(operatingIncome) - financing,
    financing,
    unitPrice: 0,
    transferable: category === "property",
    distress: cents(down / 2),
    description: `${category === "property" ? "A financed rental" : "A business investment"} with $${operatingIncome.toLocaleString("en-US")} monthly operating income before financing. Compare the net cash flow below with the cash reserve and debt this purchase needs.`,
    source: investmentSource(tier === "small" ? "small-deals" : "big-deals"),
  };
};
const smallProperties: [string, number, number, number][] = [
  ["Studio Apartment", 35000, 2000, 140],
  ["Parking Space", 8000, 1000, 60],
  ["Storage Unit", 12000, 1500, 80],
  ["Small Condo", 45000, 3000, 180],
  ["Duplex (half)", 50000, 4000, 220],
  ["Garage Conversion", 25000, 2000, 100],
];
const stocks: [string, number][] = [
  ["TechNova Corp", 5],
  ["GreenLeaf Energy", 10],
  ["MegaMart Retail", 20],
  ["BioGen Pharma", 30],
  ["CloudPeak Software", 40],
  ["Growth Mutual Fund", 100],
  ["Index Tracker 500", 150],
  ["AeroSpace Dynamics", 15],
  ["CryptoCoin Trust", 8],
  ["OldBlue Chip Co.", 55],
];
const smallBusinesses: [string, number, number][] = [
  ["Vending Machine Route", 3500, 120],
  ["Car Wash Share", 4500, 150],
  ["Laundromat Partner", 5000, 200],
  ["Food Truck Share", 4000, 180],
];
export const encyclopediaSmallDeals: Deal[] = [
  ...stocks.map(([name, price], i): Deal => ({
    id: `enc-ss${i}`,
    name,
    category: "stock",
    tier: "small",
    cost: cents(price),
    down: cents(price),
    unitPrice: cents(price),
    mortgage: 0,
    financing: 0,
    income: 0,
    transferable: false,
    distress: cents(price / 2),
    description:
      "A capital-gains investment with no recurring dividend. Choose a share count and pay in full. A future market buyer may offer more or less than your purchase price.",
    source: source(
      "small-deals",
      "Source share prices and zero recurring dividends are retained. Shares follow this game’s seeded decks, economic repricing, and eligible market-sale rules.",
    ),
  })),
  ...smallProperties.map(([name, cost, down, income], i) =>
    financed(`enc-sp${i}`, name, "property", cost, down, income, "small"),
  ),
  ...smallBusinesses.map(([name, cost, income], i) =>
    financed(`enc-sb${i}`, name, "business", cost, cost, income, "small"),
  ),
];
const largeProperties: [string, number, number, number][] = [
  ["4-Plex Apartment", 120000, 12000, 500],
  ["8-Plex Apartment", 220000, 22000, 900],
  ["Suburban House Rental", 65000, 5000, 250],
  ["Downtown Loft", 90000, 9000, 350],
  ["Strip Mall Unit", 150000, 20000, 700],
  ["Farmland Parcel", 80000, 10000, 300],
  ["Beach Condo", 110000, 15000, 400],
  ["Mobile Home Park", 95000, 12000, 450],
  ["Office Floor", 250000, 50000, 1500],
];
const largeBusinesses: [string, number, number, number][] = [
  ["Franchise Restaurant", 100000, 25000, 800],
  ["Auto Repair Shop", 75000, 15000, 600],
  ["E-Commerce Brand", 60000, 20000, 500],
  ["Gym & Fitness Center", 130000, 30000, 900],
  ["Self-Storage Facility", 200000, 40000, 1200],
  ["Daycare Center", 85000, 18000, 650],
];
export const encyclopediaLargeDeals: Deal[] = [
  ...largeProperties.map(([name, cost, down, income], i) =>
    financed(`enc-lp${i}`, name, "property", cost, down, income, "large"),
  ),
  ...largeBusinesses.map(([name, cost, down, income], i) =>
    financed(`enc-lb${i}`, name, "business", cost, down, income, "large"),
  ),
];
const buyers: [string, "property" | "business" | "stock", number][] = [
  ["Investor Group", "property", 2],
  ["Tech Relocation Boom", "property", 1.5],
  ["Stock Buyback", "stock", 80],
  ["Pharma Acquisition", "stock", 120],
  ["Corporate Buyer", "business", 2],
  ["Government Eminent Domain", "property", 1.8],
  ["IPO Windfall", "stock", 200],
  ["Foreign Investor", "property", 2.5],
  ["Franchise Expansion", "business", 1.5],
  ["Crypto Surge", "stock", 50],
  ["Developer Offer", "property", 3],
  ["Energy Boom", "stock", 60],
];
export const encyclopediaMarkets: MarketCard[] = buyers.map(
  ([name, category, offer], i) => ({
    id: `enc-m${i}`,
    name,
    category,
    effect: "offer",
    amount: 0,
    multiplier: category === "stock" ? 1 : offer,
    ...(category === "stock" ? { sharePrice: cents(offer) } : {}),
    description:
      category === "stock"
        ? `A buyer offers $${offer} per share for any stock or fund you own, before current economic price effects. Selling is optional; compare with your purchase cost.`
        : `A buyer offers ${offer} times the current value of an eligible ${category}. Remaining financing is deducted from proceeds; you may keep the investment.`,
    source: source(
      "market",
      "Source buyer categories and quotes are retained. Economic cycles affect quotes; mortgages are settled from sale proceeds. Offers are optional for every eligible owner, and cards use this game’s seeded deck rather than independent repeat draws.",
    ),
  }),
);
const doodads: [string, number, string][] = [
  [
    "Subscription Creep",
    200,
    "Renewals from several services arrive together.",
  ],
  ["Traffic Ticket", 300, "A traffic fine requires an immediate payment."],
  [
    "Gadget Addiction",
    350,
    "A wearable upgrade takes cash out of your savings.",
  ],
  ["Wedding Gift", 400, "A family wedding adds an unplanned gift expense."],
  ["Parking Damage", 450, "Repair damage to your parked vehicle."],
  ["Car Repair", 500, "An unexpected mechanical fault needs attention."],
  ["New Phone", 600, "Replace a damaged phone."],
  ["Pet Emergency", 700, "Urgent veterinary care creates a cash bill."],
  ["Furniture Upgrade", 750, "Replace worn household furniture."],
  ["Medical Bill", 800, "Pay the uncovered portion of an emergency visit."],
  ["Appliance Breakdown", 900, "Two essential appliances need replacing."],
  ["Tax Surprise", 1000, "Settle an unexpected tax balance."],
  ["Home Repair", 1200, "A roof problem needs prompt repairs."],
  ["Vacation", 1500, "An agreed family trip comes due."],
  [
    "Lawsuit Settlement",
    2000,
    "A liability claim results in a one-time settlement.",
  ],
];
export const encyclopediaExpenses: ExpenseCard[] = doodads.map(
  ([name, cost, description], i) => ({
    id: `enc-e${i}`,
    name,
    cost: cents(cost),
    description,
    source: source(
      "doodads",
      "Source baseline dollar costs are fixed equally for every profession, matching this playtest’s economy. Bills are mandatory; cash shortfalls use the existing borrowing, distress-sale, and bankruptcy process. No salary multiplier is applied.",
    ),
  }),
);
export const encyclopediaSpecialSource = source(
  "special",
  "Baby, downsizing, and charity use the existing board spaces. Children use profession-specific costs, up to three. Downsizing charges one month’s expenses and skips two turns. Charity remains optional, costs 10% of total income, and grants a choice of extra dice. No extra layoff charges are added during skipped turns.",
);
