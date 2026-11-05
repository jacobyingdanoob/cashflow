import type { Asset, Deal, EconomicEvent, GameState, Player } from "./types";
export const FIRST_ECONOMIC_ROUND = 11;
export const ECONOMIC_INTERVAL = 3;
export const isEconomicRound = (round: number) =>
  round >= FIRST_ECONOMIC_ROUND &&
  (round - FIRST_ECONOMIC_ROUND) % ECONOMIC_INTERVAL === 0;

const housing = {
  label: "Federal Reserve History: the Great Recession",
  url: "https://www.federalreservehistory.org/essays/great-recession-and-its-aftermath",
};
const rates = {
  label: "Federal Reserve: monetary policy and open market operations",
  url: "https://www.federalreserve.gov/monetarypolicy/openmarket.htm",
};
const prices = {
  label: "FRED: US home price index",
  url: "https://fred.stlouisfed.org/series/CSUSHPINSA",
};
const retail = {
  label: "FRED: US retail sales",
  url: "https://fred.stlouisfed.org/series/MRTSSM44000USS",
};
const inflation = {
  label: "FRED: consumer price index",
  url: "https://fred.stlouisfed.org/series/CPIAUCSL",
};
const shares = {
  label: "FRED: NASDAQ Composite Index, including the dot-com boom and bust",
  url: "https://fred.stlouisfed.org/series/NASDAQCOM",
};
export const economicEvents: EconomicEvent[] = [
  {
    id: "housing-crash",
    name: "Housing credit crunch",
    tone: "negative",
    description:
      "Property values and new property prices fall 20%. Rents and outstanding principal stay unchanged.",
    scenario:
      "Inspired by the 2007–2009 housing downturn: falling collateral values can leave leveraged owners with little equity.",
    source: housing,
    affected:
      "All existing properties, property deals, sale offers, and distress equity.",
    duration: 3,
    values: { property: 0.8 },
  },
  {
    id: "rate-hike",
    name: "Emergency rate hike",
    tone: "negative",
    description:
      "All recurring loan payments and investment financing costs double. Principal balances do not double.",
    scenario:
      "Inspired by tightening cycles such as 2022–2023. This game stress test treats all loans as exposed to repricing; real fixed-rate loans would behave differently.",
    source: rates,
    affected:
      "Bank interest, home/student/car/card/equipment payments, and financed properties. Debt-free holdings avoid the financing shock.",
    duration: 3,
    loanPayments: 2,
  },
  {
    id: "rent-boom",
    name: "Rental demand boom",
    tone: "positive",
    description: "Property operating income before financing rises 10%.",
    scenario:
      "Inspired by housing shortages and stronger rental demand. Extra rent benefits owners while their debt service stays separate.",
    source: prices,
    affected:
      "Rental property holdings and the advertised income of property opportunities.",
    duration: 3,
    income: { property: 1.1 },
  },
  {
    id: "rate-cut",
    name: "Credit becomes cheaper",
    tone: "positive",
    description:
      "All recurring loan payments and investment financing costs fall 25%.",
    scenario:
      "Inspired by monetary easing after recessions. The game assumes loan costs can reprice in either direction.",
    source: rates,
    affected:
      "All household debts, bank loans, and financed investment properties.",
    duration: 3,
    loanPayments: 0.75,
  },
  {
    id: "recession",
    name: "Main Street recession",
    tone: "negative",
    description:
      "Business operating income falls 25%; business values and entry prices fall 15%.",
    scenario:
      "Inspired by recession-driven cuts in consumer spending and small-business valuations.",
    source: retail,
    affected:
      "Small businesses, Fast Track businesses, and business market offers; salaries remain fixed in this simplified model.",
    duration: 3,
    income: { business: 0.75 },
    values: { business: 0.85 },
  },
  {
    id: "reopening",
    name: "Main Street reopening",
    tone: "positive",
    description:
      "Business operating income rises 20% and business values rise 10%.",
    scenario:
      "Inspired by reopening demand after pandemic restrictions. A recovery can lift both sales and business valuations.",
    source: retail,
    affected:
      "All business holdings, new business purchases, and eligible business sales.",
    duration: 3,
    income: { business: 1.2 },
    values: { business: 1.1 },
  },
  {
    id: "stock-selloff",
    name: "Equity market sell-off",
    tone: "negative",
    description:
      "Stock values and share purchase prices fall 30%. Recurring dividends are unchanged.",
    scenario:
      "Inspired by abrupt equity repricing during the dot-com bust and other market sell-offs. A price decline is distinct from a dividend cut.",
    source: shares,
    affected:
      "Existing stocks, new share purchases, stock sale offers, and distress equity.",
    duration: 3,
    values: { stock: 0.7 },
  },
  {
    id: "stock-rally",
    name: "Broad market recovery",
    tone: "positive",
    description: "Stock values and new share purchase prices rise 20%.",
    scenario:
      "Inspired by equity recoveries following market downturns; paying a higher price does not automatically buy a higher dividend.",
    source: shares,
    affected: "Stock holdings, share deals, and stock market sale proceeds.",
    duration: 3,
    values: { stock: 1.2 },
  },
  {
    id: "vacancies",
    name: "Vacancy shock",
    tone: "negative",
    description: "Property operating income before financing falls 30%.",
    scenario:
      "Inspired by job losses and vacant rental units during local downturns. Financing payments continue even when rent falls.",
    source: housing,
    affected:
      "All rental properties; leverage can turn positive net rent negative.",
    duration: 3,
    income: { property: 0.7 },
  },
  {
    id: "renewal",
    name: "Neighborhood renewal",
    tone: "positive",
    description: "Property values and new property prices rise 15%.",
    scenario:
      "Inspired by neighborhood investment and stronger housing demand. Unrealized value gains do not add cash or rent.",
    source: prices,
    affected:
      "Property valuations, entry prices, market sales, and available distress equity.",
    duration: 3,
    values: { property: 1.15 },
  },
  {
    id: "input-costs",
    name: "Input cost squeeze",
    tone: "negative",
    description: "Business operating income falls 15%.",
    scenario:
      "Inspired by the 2021–2022 inflation surge: higher input costs can compress business margins.",
    source: inflation,
    affected:
      "Operating income of small and Fast Track businesses; unrelated rental and stock income is unchanged.",
    duration: 3,
    income: { business: 0.85 },
  },
  {
    id: "productivity",
    name: "Productivity dividend",
    tone: "positive",
    description: "Business operating income rises 15%.",
    scenario:
      "Inspired by productivity gains from better equipment and processes, which can improve margins without increasing debt.",
    source: retail,
    affected:
      "All business holdings and the income quoted on new business opportunities.",
    duration: 3,
    income: { business: 1.15 },
  },
  {
    id: "dividend-cut",
    name: "Dividend conservation",
    tone: "negative",
    description: "Recurring stock dividend income falls 40%.",
    scenario:
      "Inspired by companies preserving cash during recessions. Dividend income can fall even without a simultaneous price shock.",
    source: housing,
    affected:
      "Recurring stock income; special one-off shareholder distributions remain governed by their own cards.",
    duration: 3,
    income: { stock: 0.6 },
  },
  {
    id: "dividend-growth",
    name: "Dividend growth season",
    tone: "positive",
    description: "Recurring stock dividend income rises 25%.",
    scenario:
      "Inspired by profitable firms increasing distributions as earnings recover.",
    source: shares,
    affected:
      "Recurring dividends from every stock holding and income quoted for new stock purchases.",
    duration: 3,
    income: { stock: 1.25 },
  },
  {
    id: "credit-squeeze",
    name: "Credit risk premium",
    tone: "negative",
    description:
      "All recurring loan payments and investment financing costs rise 25%.",
    scenario:
      "Inspired by lenders demanding higher compensation for credit risk during financial stress; the game reprices all borrowing for a transparent stress test.",
    source: housing,
    affected:
      "Personal debts, bank interest, and financed investment properties.",
    duration: 3,
    loanPayments: 1.25,
  },
  {
    id: "confidence",
    name: "Consumer confidence returns",
    tone: "positive",
    description:
      "Business values and entry prices rise 15%; business operating income rises 10%.",
    scenario:
      "Inspired by recoveries in consumer spending and confidence after downturns.",
    source: retail,
    affected:
      "Business holdings, new opportunities, Fast Track businesses, and business sales.",
    duration: 3,
    values: { business: 1.15 },
    income: { business: 1.1 },
  },
];
export function initializeEconomy(s: GameState) {
  s.config.liquidityRisk ??= true;
  s.config.principalRate ??= 0;
  s.config.economicCycles ??= true;
  s.economy ??= {
    version: 1,
    active: [],
    deck: [],
    lastRound: s.round,
    principalPaid: {},
    warned: {},
  };
}
export function factor(
  s: GameState | undefined,
  key: "values" | "income" | "loanPayments",
  category?: Asset["category"],
) {
  return (
    s?.economy?.active.reduce((value, a) => {
      const event = economicEvents.find((c) => c.id === a.card)!;
      return (
        value *
        (key === "loanPayments"
          ? (event.loanPayments ?? 1)
          : (event[key]?.[category!] ?? 1))
      );
    }, 1) ?? 1
  );
}
export function assetValue(s: GameState | undefined, a: Asset) {
  return Math.round(
    (a.referenceValue ?? a.cost) * factor(s, "values", a.category),
  );
}
export function assetIncomeBreakdown(s: GameState | undefined, a: Asset) {
  const operating = Math.round(
      (a.income + a.financing) * factor(s, "income", a.category),
    ),
    financing = Math.round(a.financing * factor(s, "loanPayments"));
  return { operating, financing, net: operating - financing };
}
export function assetIncome(s: GameState | undefined, a: Asset) {
  return assetIncomeBreakdown(s, a).net;
}
export function debtPayment(s: GameState, d: Player["debts"][number]) {
  return Math.round(
    (d.kind === "bank"
      ? Math.round((d.principal * s.config.annualRate) / 1200)
      : d.payment) * factor(s, "loanPayments"),
  );
}
export function effectiveDeal(s: GameState, c: Deal): Deal {
  const scale = factor(s, "values", c.category),
    cost = Math.max(1, Math.round(c.cost * scale)),
    down = Math.max(1, Math.round(c.down * scale)),
    mortgage = Math.max(0, cost - down),
    financing = c.mortgage
      ? Math.round((c.financing * mortgage) / c.mortgage)
      : 0;
  return {
    ...c,
    cost,
    down,
    mortgage,
    financing,
    income: c.income + c.financing - financing,
    unitPrice: c.unitPrice ? Math.max(1, Math.round(c.unitPrice * scale)) : 0,
    distress: Math.round(down / 2),
    referenceCost: c.cost,
  };
}
export function installment(p: Player, rate: number) {
  const portion = (n: number) =>
    Math.min(n, Math.max(n > 0 ? 1 : 0, Math.round((n * rate) / 100)));
  return rate === 0
    ? 0
    : p.debts.reduce((sum, d) => sum + portion(d.principal), 0) +
        p.assets.reduce((sum, a) => sum + portion(a.mortgage), 0);
}
export function repayPrincipal(p: Player, id: string, amount: number) {
  const debt = p.debts.find((d) => d.id === id),
    asset = p.assets.find((a) => a.id === id);
  if (debt) {
    debt.paymentBasis ??= { principal: debt.principal, payment: debt.payment };
    debt.principal -= amount;
    debt.payment = debt.principal
      ? Math.round(
          (debt.paymentBasis.payment * debt.principal) /
            debt.paymentBasis.principal,
        )
      : 0;
    if (!debt.principal) p.debts = p.debts.filter((d) => d.id !== id);
  } else if (asset) {
    asset.financingBasis ??= {
      principal: asset.mortgage,
      payment: asset.financing,
    };
    asset.mortgage -= amount;
    const next = asset.mortgage
      ? Math.round(
          (asset.financingBasis.payment * asset.mortgage) /
            asset.financingBasis.principal,
        )
      : 0;
    asset.income += asset.financing - next;
    asset.financing = next;
  }
}
export function payInstallment(p: Player, rate: number) {
  if (rate === 0) return;
  const amount = installment(p, rate);
  p.cash -= amount;
  for (const debt of [...p.debts])
    repayPrincipal(
      p,
      debt.id,
      Math.min(
        debt.principal,
        Math.max(1, Math.round((debt.principal * rate) / 100)),
      ),
    );
  for (const asset of p.assets.filter((a) => a.mortgage > 0))
    repayPrincipal(
      p,
      asset.id,
      Math.min(
        asset.mortgage,
        Math.max(1, Math.round((asset.mortgage * rate) / 100)),
      ),
    );
}
export function totalDebt(p: Player) {
  return (
    p.debts.reduce((v, d) => v + d.principal, 0) +
    p.assets.reduce((v, a) => v + a.mortgage, 0)
  );
}
export function requiredReserve(p: Player) {
  return Math.ceil(totalDebt(p) / 10);
}
export function distressValue(s: GameState, a: Asset) {
  return Math.max(0, Math.floor((assetValue(s, a) - a.mortgage) / 2));
}
