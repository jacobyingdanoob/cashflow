import type { Profile } from "./types";
export const personalities: Record<
  Profile,
  {
    name: string;
    philosophy: string;
    priority: string;
    months: number;
    debtRatio: number;
    behavior: string;
  }
> = {
  cautious: {
    name: "Conservative saver",
    philosophy: "Debt is dangerous. Cash is king.",
    priority: "Type 2 → cheap Type 3; never Type 1",
    months: 3,
    debtRatio: 0.25,
    behavior:
      "Buys debt-free assets using existing cash. Keeps 25% of debt plus three months of expenses; never borrows for an investment.",
  },
  bold: {
    name: "Aggressive leverager",
    philosophy: "Use the bank's money to grow.",
    priority: "Type 1 → Type 2 → Type 3",
    months: 0.25,
    debtRatio: 0.02,
    behavior:
      "Borrows for financed or debt-free assets even when interest consumes the income. Keeps the legal debt reserve plus a quarter-month buffer and recycles sale proceeds into expansion.",
  },
  income: {
    name: "Speculator / day trader",
    philosophy: "Buy low, sell high. Cash flow can wait.",
    priority: "Type 3 → Type 1 → Type 2",
    months: 0.1,
    debtRatio: 0.02,
    behavior:
      "Puts 90% of spare cash into stocks, including zero-dividend shares. Holds through most crashes and sells profitable rallies. After $20,000 realized stock gains, considers outright property or business purchases.",
  },
  diverse: {
    name: "Balanced investor",
    philosophy: "Control the downside first.",
    priority:
      "Stocks with low cash; Type 1 with medium cash; Type 2 with high cash",
    months: 1,
    debtRatio: 0.15,
    behavior:
      "Keeps 15% of debt plus one month of expenses. Weighs income against borrowing costs, sells profitable stocks to reduce investment debt, and looks for discounted opportunities after declines.",
  },
};
