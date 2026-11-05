import { useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Landmark,
  Plus,
  TrendingUp,
} from "lucide-react";
import { dreams, professions } from "../game/content";
import { money, playerFinancials, preciseMoney } from "../game/engine";
import type { GameAction, GameState } from "../game/types";
import GameReview from "./GameReview";
import DebtRepayment from "./DebtRepayment";
import AssetCashFlow from "./AssetCashFlow";
import {
  assetIncome,
  assetValue,
  debtPayment,
  distressValue,
  factor,
  installment,
  requiredReserve,
} from "../game/economy";
export default function Finances({
  game,
  dispatch,
  results = false,
}: {
  game: GameState;
  dispatch: (a: GameAction) => void;
  results?: boolean;
}) {
  const [tab, setTab] = useState(results ? "results" : "statement"),
    [loan, setLoan] = useState(1000);
  const p = game.players[0],
    f = playerFinancials(game, p),
    canManage =
      !p.eliminated &&
      game.current === 0 &&
      !game.pending &&
      game.phase !== "finished" &&
      game.decision?.kind !== "market" &&
      game.decision?.kind !== "liquidity";
  const rows = (values: [string, number][]) =>
    values.map(([label, value]) => (
      <div className="statement-row" key={label}>
        <span>{label}</span>
        <strong>{preciseMoney(value)}</strong>
      </div>
    ));
  if (p.eliminated) return <GameReview game={game} personal={!results} />;
  return (
    <div className="finances-modal">
      {game.config.accounting === "auto" &&
        game.config.liquidityRisk &&
        p.cash < requiredReserve(p) && (
          <div className="liquidity-warning" role="status">
            <strong>Low cash reserve</strong>
            <p>
              Cash {preciseMoney(p.cash)} is below 10% of total debt. Reserve
              needed: {preciseMoney(requiredReserve(p))}. Restore the buffer
              before ending your turn to avoid a forced sale.
            </p>
          </div>
        )}
      {game.config.principalRate > 0 && (
        <div className="principal-budget">
          <span>
            Principal due separately at turn end ({game.config.principalRate}%)
          </span>
          <strong>
            {preciseMoney(
              game.economy.principalPaid[p.id] === game.round
                ? 0
                : installment(p, game.config.principalRate),
            )}
          </strong>
          <small>
            Reduces cash and liabilities; excluded from recurring expenses and
            never charged twice at Payday.
          </small>
        </div>
      )}
      {tab !== "results" && (
        <div className="finance-overview">
          <div>
            <span className="eyebrow">YOUR FINANCIAL PICTURE</span>
            <h3>{professions.find((pr) => pr.id === p.profession)?.name}</h3>
            <p>
              Building toward{" "}
              {dreams.find((d) => d.id === p.dream)?.name.toLowerCase()}
            </p>
          </div>
          <div>
            <span>Cash on hand</span>
            <strong>{money(p.cash)}</strong>
          </div>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Financial views">
        {[
          ...(results ? [["results", "Results"]] : []),
          ["statement", "Statement"],
          ["assets", "Portfolio"],
          ["debt", "Loans & debt"],
          ["ledger", "Transactions"],
        ].map(([id, label]) => (
          <button
            role="tab"
            aria-selected={tab === id}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "statement" && (
        <div className="statement-grid">
          <section>
            <h3>
              <ArrowDownLeft size={17} /> Monthly income
            </h3>
            {rows([
              ["Salary", p.salary],
              [
                "Property income",
                p.assets
                  .filter((a) => a.category === "property")
                  .reduce((n, a) => n + assetIncome(game, a), 0),
              ],
              [
                "Business income",
                p.assets
                  .filter((a) => a.category === "business")
                  .reduce((n, a) => n + assetIncome(game, a), 0),
              ],
              [
                "Share dividends",
                p.assets
                  .filter((a) => a.category === "stock")
                  .reduce((n, a) => n + assetIncome(game, a), 0),
              ],
            ])}
            <div className="statement-total">
              <span>Total income</span>
              <strong>{preciseMoney(f.income)}</strong>
            </div>
            <h3 className="spaced-title">
              <TrendingUp size={17} /> Monthly cash flow
            </h3>
            <p className={`big-financial ${f.flow < 0 ? "negative" : ""}`}>
              {preciseMoney(f.flow)}
            </p>
            <p className="small muted">
              What remains after all recurring expenses. Collected when you pass
              or land on Payday.
            </p>
          </section>
          <section>
            <h3>
              <ArrowUpRight size={17} /> Monthly expenses
            </h3>
            {rows([
              ["Taxes", p.taxes],
              ["Household living costs", p.living],
              ["Child expenses", p.childCost * p.children],
              ...p.debts.map(
                (d) => [d.name, debtPayment(game, d)] as [string, number],
              ),
            ])}
            <div className="statement-total">
              <span>Total expenses</span>
              <strong>{preciseMoney(f.expenses)}</strong>
            </div>
            <p className="small muted">
              Investment cash flow is already net of its financing and operating
              costs; those payments are not charged again here.
            </p>
          </section>
        </div>
      )}
      {tab === "assets" && (
        <section>
          <div className="statement-total">
            <span>Investment assets at current game values</span>
            <strong>{money(f.assets)}</strong>
          </div>
          {!p.assets.length ? (
            <div className="empty-state">
              <BookOpen size={32} />
              <h3>A blank page with plenty of potential.</h3>
              <p>
                Your first investment will appear here. Look for opportunity
                spaces.
              </p>
            </div>
          ) : (
            p.assets.map((a) => (
              <article className="portfolio-item" key={a.id}>
                <div className="portfolio-icon">
                  <Landmark size={23} />
                </div>
                <div>
                  <h4>{a.name}</h4>
                  <p>
                    {a.category === "stock"
                      ? `${a.shares} shares · ${preciseMoney(a.unitPrice)} original unit cost`
                      : `${money(a.down)} down · ${money(a.mortgage)} remaining financing`}
                  </p>
                  <small>
                    Cost basis {money(a.cost)} · Distress recovery{" "}
                    {money(distressValue(game, a))} · Current value{" "}
                    {money(assetValue(game, a))}
                  </small>
                  <AssetCashFlow game={game} asset={a} collapsible />
                </div>
                <strong className={assetIncome(game, a) < 0 ? "negative" : ""}>
                  {preciseMoney(assetIncome(game, a))}
                  <small>/ month, net</small>
                </strong>
              </article>
            ))
          )}
          <p className="small muted">
            Assets can be sold only when an eligible market event permits it, or
            through liquidity or bankruptcy recovery. Net worth uses current
            game values, including active economic-cycle effects. Cost basis
            remains recorded separately.
          </p>
        </section>
      )}
      {tab === "debt" && (
        <section>
          <div className="statement-total">
            <span>Total liabilities, including investment mortgages</span>
            <strong>{money(f.debt)}</strong>
          </div>
          {p.debts.map((d) => (
            <DebtRepayment
              key={d.id}
              game={game}
              debt={d}
              disabled={!canManage}
              dispatch={dispatch}
            />
          ))}
          {p.assets
            .filter((a) => a.mortgage > 0)
            .map((a) => (
              <DebtRepayment
                key={a.id}
                game={game}
                asset={a}
                disabled={!canManage}
                dispatch={dispatch}
              />
            ))}
          <div className="loan-box">
            <h3>
              <Landmark size={18} /> A little leverage
            </h3>
            <p>
              Borrow in $1,000 increments. Interest is {game.config.annualRate}%
              per year before active economic effects, charged monthly on
              outstanding principal. Repay any amount down to the cent;
              principal repayments are optional.
              {game.config.principalRate > 0
                ? ` This match opted into ${game.config.principalRate}% principal autopay at turn end.`
                : " Principal autopay is off in this match."}
            </p>
            <div className="borrow-row">
              <label className="form-field">
                Loan amount ($)
                <input
                  aria-label="Loan amount"
                  type="number"
                  min="1000"
                  max="1000000"
                  step="1000"
                  value={loan}
                  onChange={(e) => setLoan(Number(e.target.value))}
                />
              </label>
              <button
                className="button primary"
                disabled={!canManage || p.bankrupt}
                onClick={() =>
                  dispatch({ type: "BORROW", amount: Math.round(loan * 100) })
                }
              >
                <Plus size={16} /> Borrow
              </button>
            </div>
            <p className="small muted">
              Adds{" "}
              {preciseMoney(
                Math.round(
                  Math.round((loan * 100 * game.config.annualRate) / 1200) *
                    factor(game, "loanPayments"),
                ),
              )}{" "}
              to monthly expenses. Manage debt on your own turn; finish any
              worksheet before another transaction.
            </p>
          </div>
        </section>
      )}
      {tab === "ledger" && (
        <section>
          {game.receipts.filter((r) => r.player === p.id).length === 0 ? (
            <div className="empty-state">
              <BookOpen size={32} />
              <h3>Your story starts here.</h3>
              <p>Every financial transaction gets a receipt.</p>
            </div>
          ) : (
            game.receipts
              .filter((r) => r.player === p.id)
              .map((r) => (
                <div className="ledger-item" key={r.id}>
                  <div>
                    <h4>{r.title}</h4>
                    <small>{r.note}</small>
                    <p>
                      Cash: {preciseMoney(r.before.cash)} →{" "}
                      {preciseMoney(r.after.cash)}
                      <br />
                      Monthly cash flow: {preciseMoney(r.before.flow)} →{" "}
                      {preciseMoney(r.after.flow)}
                    </p>
                  </div>
                  <strong
                    className={
                      r.after.cash - r.before.cash < 0 ? "negative" : "positive"
                    }
                  >
                    {r.after.cash - r.before.cash >= 0 ? "+" : ""}
                    {preciseMoney(r.after.cash - r.before.cash)}
                  </strong>
                </div>
              ))
          )}
        </section>
      )}
      {tab === "results" && <GameReview game={game} />}
    </div>
  );
}
