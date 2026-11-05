import { deals, dreams, expenses, markets, professions } from "./content";
import { economicEvents } from "./economy";
import type {
  Deal,
  Dream,
  EconomicEvent,
  ExpenseCard,
  MarketCard,
  Profession,
} from "./types";

export interface SpecialEntry {
  id: string;
  name: string;
  description: string;
  trigger: string;
  effect: string;
  strategy: string;
}
export const specialEntries: SpecialEntry[] = [
  {
    id: "payday",
    name: "Payday",
    description:
      "Collect the monthly cash flow your financial statement has earned.",
    trigger: "Pass or land on a Payday space on either track.",
    effect:
      "Receive salary plus passive income minus expenses for each Payday crossed. Negative cash flow creates a mandatory bill instead. Scheduled principal, if enabled, is separate and is not deducted twice.",
    strategy:
      "A salary is helpful, but reducing expenses and growing passive income makes each Payday more resilient.",
  },
  {
    id: "charity",
    name: "Give back",
    description:
      "An optional donation exchanges some cash for extra movement choices.",
    trigger: "Land on Give back on either track.",
    effect:
      "Donate 10% of total monthly income. On the Rat Race, you may use one or two dice for your next three rolls. On the Fast Track, a donation unlocks one, two or three dice for the rest of that stage. You may decline.",
    strategy:
      "Compare the donation with the cash reserve you need. Extra dice change movement, not the fairness of each die.",
  },
  {
    id: "baby",
    name: "A new arrival",
    description: "Family growth adds a recurring cost to your household.",
    trigger: "Land on New arrival on the Rat Race.",
    effect:
      "Add your role’s monthly child cost to household expenses. The limit is three children; later visits add no further cost. There is no separate one-time birth bill.",
    strategy:
      "Leave room in your monthly surplus for family costs when deciding how much debt service you can afford.",
  },
  {
    id: "downsized",
    name: "Downsized",
    description: "A job setback costs cash and two turns of recovery.",
    trigger: "Land on Downsized on the Rat Race.",
    effect:
      "Pay one month of total expenses and miss your next two turns. Your charity bonus ends. No additional layoff bill is charged on the skipped turns.",
    strategy:
      "A cash reserve helps cover the bill without selling investments or adding expensive borrowing.",
  },
  {
    id: "audit",
    name: "Tax audit",
    description: "An unexpected tax settlement takes half your available cash.",
    trigger: "Land on Tax audit on the Fast Track.",
    effect:
      "Pay 50% of cash on hand, rounded down to cents. Holdings and principal balances remain unchanged, but the smaller reserve may expose liquidity risk.",
    strategy:
      "Consider reserve exposure alongside your investment plan; a large net worth does not guarantee enough liquid cash.",
  },
  {
    id: "lawsuit",
    name: "Lawsuit settlement",
    description: "A legal settlement removes half your available cash.",
    trigger: "Land on Lawsuit on the Fast Track.",
    effect:
      "Pay 50% of cash on hand, rounded down to cents. This is a cash charge, not a permanent increase in monthly expenses.",
    strategy:
      "Plan how you would rebuild liquidity after a large one-time loss.",
  },
  {
    id: "divorce",
    name: "Divorce settlement",
    description: "A major life change consumes all cash on hand.",
    trigger: "Land on Divorce on the Fast Track.",
    effect:
      "Pay all available cash. Assets and outstanding loans remain. Liquidity checks still apply when that rule is enabled.",
    strategy:
      "Keeping debt manageable makes it easier to recover from a cash shock.",
  },
  {
    id: "liquidity",
    name: "Liquidity crisis",
    description: "Too little cash relative to debt can force investment sales.",
    trigger:
      "With liquidity risk enabled, cash is below 10% of total debt at the start or end of a turn.",
    effect:
      "Sell assets for 50% of current equity: max(0, market value minus remaining financing) ÷ 2. The associated financing is settled and income is removed. Continue until the reserve is restored, or enter bankruptcy recovery. Warning hints appear only in automatic accounting; the rule applies in both modes.",
    strategy:
      "Budget for the cash reserve needed by a new mortgage as well as its down payment.",
  },
  {
    id: "bankruptcy",
    name: "Bankruptcy recovery",
    description:
      "Try to repair an insolvent balance sheet before leaving the game.",
    trigger: "A mandatory bill or liquidity crisis cannot be resolved.",
    effect:
      "The engine liquidates investments and attempts debt recovery. One-time 50% relief on car, credit-card and retail balances may apply. Successful recovery loses three turns and blocks new bank loans during recovery; liquidity calls receive a three-turn grace period. Unrecoverable players are eliminated.",
    strategy:
      "Pay attention to recurring cash flow and cash reserves before debt makes recovery difficult.",
  },
];

export type WikiCategory =
  | "roles"
  | "opportunities"
  | "market"
  | "expenses"
  | "cycles"
  | "dreams"
  | "special";
export type WikiEntry =
  | { kind: "roles"; item: Profession }
  | { kind: "opportunities"; item: Deal }
  | { kind: "market"; item: MarketCard }
  | { kind: "expenses"; item: ExpenseCard }
  | { kind: "cycles"; item: EconomicEvent }
  | { kind: "dreams"; item: Dream }
  | { kind: "special"; item: SpecialEntry };

export const wikiCategories: {
  id: WikiCategory;
  name: string;
  description: string;
}[] = [
  {
    id: "roles",
    name: "Roles",
    description: "15 starting lives, across three difficulty tiers.",
  },
  {
    id: "opportunities",
    name: "Opportunities",
    description: "Small deals, large deals and Fast Track investments.",
  },
  {
    id: "market",
    name: "Market cards",
    description: "Buyer offers, share splits and special distributions.",
  },
  {
    id: "expenses",
    name: "Life expenses",
    description: "The one-time bills that put your reserve to work.",
  },
  {
    id: "cycles",
    name: "Sudden events",
    description: "Positive and negative economic cycles, starting in round 11.",
  },
  {
    id: "dreams",
    name: "Dreams",
    description: "Eight goals to build toward on the Fast Track.",
  },
  {
    id: "special",
    name: "Special events",
    description: "Board spaces, liquidity crises and bankruptcy recovery.",
  },
];

// Definitions only: the wiki never reads shuffled decks or future rolls.
export const wikiEntries: WikiEntry[] = [
  ...professions.map((item): WikiEntry => ({ kind: "roles", item })),
  ...deals.map((item): WikiEntry => ({ kind: "opportunities", item })),
  ...markets.map((item): WikiEntry => ({ kind: "market", item })),
  ...expenses.map((item): WikiEntry => ({ kind: "expenses", item })),
  ...economicEvents.map((item): WikiEntry => ({ kind: "cycles", item })),
  ...dreams.map((item): WikiEntry => ({ kind: "dreams", item })),
  ...specialEntries.map((item): WikiEntry => ({ kind: "special", item })),
];
export const wikiEntryId = (entry: WikiEntry) =>
  `${entry.kind}:${entry.item.id}`;
export function isAdaptedEntry(entry: WikiEntry) {
  return (
    (entry.kind === "opportunities" ||
      entry.kind === "market" ||
      entry.kind === "expenses") &&
    !!entry.item.source
  );
}
export function wikiSearchText(entry: WikiEntry) {
  const extra =
    entry.kind === "roles"
      ? [
          entry.item.difficulty,
          ...entry.item.traits,
          entry.item.pursue,
          entry.item.avoid,
          entry.item.debtStory,
        ]
      : entry.kind === "opportunities"
        ? [
            entry.item.category,
            entry.item.tier,
            entry.item.tier === "large" ? "big deal" : "",
            entry.item.transferable ? "transferable" : "",
          ]
        : entry.kind === "cycles"
          ? [entry.item.tone, entry.item.affected, entry.item.scenario]
          : entry.kind === "market"
            ? [entry.item.category, entry.item.effect]
            : entry.kind === "special"
              ? [entry.item.trigger, entry.item.effect, entry.item.strategy]
              : [];
  return [
    entry.item.name,
    entry.item.description,
    wikiCategories.find((c) => c.id === entry.kind)!.name,
    isAdaptedEntry(entry) ? "adapted encyclopedia" : "original",
    ...extra,
  ]
    .join(" ")
    .toLowerCase();
}
