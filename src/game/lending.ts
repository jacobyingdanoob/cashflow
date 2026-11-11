import type { GameState, Player, Debt } from "./types";
import {
  assetIncome,
  assetIncomeBreakdown,
  debtPayment,
  factor,
} from "./economy";
import type { purchaseQuote } from "./market";

export const BANK_MONTHLY_BPS = 200;
export const PURCHASE_MONTHLY_BPS = 100;
export const DTI_LIMIT = 0.55;
export const loanIncrement = 100000;
export const maxLoan = 100000000;
export const validLoanAmount = (n: number) =>
  Number.isSafeInteger(n) && n >= 0 && n <= maxLoan && n % loanIncrement === 0;
export function loanInterest(s: GameState, amount: number, purchase = false) {
  return Math.round(
    Math.round(
      amount *
        (s.marketState ? (purchase ? 0.01 : 0.02) : s.config.annualRate / 1200),
    ) * factor(s, "loanPayments"),
  );
}
export function lendingSnapshot(s: GameState, p: Player) {
  return {
    service:
      p.assets.reduce(
        (sum, a) => sum + assetIncomeBreakdown(s, a).financing,
        0,
      ) +
      p.debts
        .filter((d) => d.kind === "bank" || d.kind === "purchase")
        .reduce((sum, d) => sum + debtPayment(s, d), 0),
    income: p.salary + p.assets.reduce((sum, a) => sum + assetIncome(s, a), 0),
    bankRate: s.marketState ? 0.02 : s.config.annualRate / 1200,
    purchaseRate: 0.01,
  };
}
export function debtCapacity(service: number, income: number, addsDebt = true) {
  const ratio = income > 0 ? service / income : service > 0 ? Infinity : 0;
  return {
    service,
    income,
    ratio,
    allowed: !addsDebt || (income > 0 && service * 100 <= income * 55),
  };
}
export function borrowingQuote(s: GameState, p: Player, amount: number) {
  const current = lendingSnapshot(s, p),
    interest = loanInterest(s, amount);
  return {
    ...debtCapacity(current.service + interest, current.income, amount > 0),
    interest,
  };
}
export function purchaseLending(
  s: GameState,
  p: Player,
  q: ReturnType<typeof purchaseQuote>,
  loan = 0,
) {
  const current = lendingSnapshot(s, p);
  const operating = Math.round(
    (q.deal.income + q.deal.financing) *
      q.count *
      factor(s, "income", q.deal.category),
  );
  const financing = Math.round(
    q.deal.financing * q.count * factor(s, "loanPayments"),
  );
  const net = operating - financing,
    interest = loanInterest(s, loan, true);
  return {
    ...debtCapacity(
      current.service + financing + interest,
      current.income + net,
      q.mortgage + loan > 0,
    ),
    operating,
    financing,
    net,
    interest,
    netAfterLoan: net - interest,
    cashAfter: p.cash + loan - q.cash,
    reserve: Math.ceil(
      (p.debts.reduce((sum, d) => sum + d.principal, 0) +
        p.assets.reduce((sum, a) => sum + a.mortgage, 0) +
        q.mortgage +
        loan) /
        10,
    ),
  };
}
export function addLoan(
  p: Player,
  amount: number,
  purchase: boolean,
  modern: boolean,
) {
  if (!amount) return;
  const kind = purchase ? "purchase" : "bank",
    monthlyRateBps = purchase ? PURCHASE_MONTHLY_BPS : BANK_MONTHLY_BPS;
  const existing = p.debts.find(
    (d) =>
      d.kind === kind &&
      (modern
        ? d.monthlyRateBps === monthlyRateBps
        : d.monthlyRateBps === undefined),
  );
  if (existing) existing.principal += amount;
  else {
    const loan: Debt = {
      id: modern ? (purchase ? "purchase-loan" : "bank-monthly") : "bank",
      name: purchase
        ? "Type 1 purchase loan · 1% monthly"
        : modern
          ? "Bank loan · 2% monthly"
          : "Bank loan",
      kind,
      principal: amount,
      payment: 0,
      ...(modern ? { monthlyRateBps } : {}),
    };
    p.debts.push(loan);
  }
}
