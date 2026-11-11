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
import {
  money,
  finances,
  playerFinancials,
  preciseMoney,
} from "../game/engine";
import type { GameAction, GameState } from "../game/types";
import GameReview from "./GameReview";
import DebtRepayment from "./DebtRepayment";
import AssetCashFlow from "./AssetCashFlow";
import AssetSale from "./AssetSale";
import TransactionLedger from "./TransactionLedger";
import {
  borrowingQuote,
  validLoanAmount,
  lendingSnapshot,
} from "../game/lending";
import {
  assetIncome,
  assetValue,
  debtPayment,
  distressValue,
  installment,
  requiredReserve,
} from "../game/economy";
export default function Finances({
  game,
  dispatch,
  results = false,
  onTabChange,
  playerId,
}: {
  game: GameState;
  dispatch: (a: GameAction) => void;
  results?: boolean;
  onTabChange?: (tab: string) => void;
  playerId?: string;
}) {
  const [tab, setTab] = useState(results ? "results" : "statement"),
    [loan, setLoan] = useState(1000);
  const p =
      game.players.find((player) => player.id === playerId) ?? game.players[0],
    f =
      p.eliminated && playerId
        ? finances(p, game.config.annualRate, game)
        : playerFinancials(game, p),
    readOnly = !p.human || p.eliminated || game.phase === "finished",
    canManage =
      p.human &&
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
  const loanAmount = Math.round(loan * 100),
    capacity = borrowingQuote(game, p, loanAmount),
    currentLending = lendingSnapshot(game, p);
  if (p.eliminated && !playerId)
    return <GameReview game={game} personal={!results} />;
  return (
    <div className="finances-modal">
      {!p.human && (
        <p className="finance-view-note">
          Viewing {p.name}’s finances · read only
        </p>
      )}
      {p.eliminated && (
        <p className="finance-view-note">
          Eliminated in round {p.elimination?.round ?? game.round}. Retained
          holdings are shown at current market values; no further turns or sales
          occur.
        </p>
      )}
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
            <span className="eyebrow">
              {p.human
                ? "YOUR FINANCIAL PICTURE"
                : `${p.name.toUpperCase()}’S FINANCIAL PICTURE`}
            </span>
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
            onClick={() => {
              setTab(id);
              onTabChange?.(id);
            }}
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
                {p.human
                  ? "Your first investment will appear here. Look for opportunity spaces."
                  : `${p.name} has no investment holdings yet.`}
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
                  {game.marketState && (
                    <small>
                      Acquired round {a.boughtRound ?? "unknown"} · Acquisition
                      fee {preciseMoney(a.acquisitionFee ?? 0)} · Tax basis{" "}
                      {preciseMoney(a.cost + (a.acquisitionFee ?? 0))}
                    </small>
                  )}
                  <AssetCashFlow game={game} asset={a} collapsible />
                </div>
                <strong className={assetIncome(game, a) < 0 ? "negative" : ""}>
                  {preciseMoney(assetIncome(game, a))}
                  <small>/ month, net</small>
                </strong>
                <AssetSale
                  game={game}
                  asset={a}
                  player={p}
                  readOnly={readOnly}
                  dispatch={dispatch}
                />
              </article>
            ))
          )}
          <p className="small muted">
            Stocks sell immediately. Businesses take 1–3 rounds with a 5%
            quick-sale discount; real estate takes 1–3 rounds with a 15%
            discount. Matching market-space sales remain immediate and avoid
            those discounts. Net worth uses current game values, including
            current market prices. Cost basis remains recorded separately.
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
              player={p}
              readOnly={readOnly}
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
                player={p}
                readOnly={readOnly}
                dispatch={dispatch}
              />
            ))}
          {!readOnly && (
            <div className="loan-box">
              <h3>
                <Landmark size={18} /> A little leverage
              </h3>
              <p>
                Borrow in $1,000 increments.{" "}
                {game.marketState
                  ? "New bank loans charge 2% monthly. Type 1 purchase loans charge 1% monthly and are available with the purchase. Existing loans retain their saved rates."
                  : `Interest is ${game.config.annualRate}% per year, charged monthly.`}{" "}
                Repay any amount down to the cent; principal repayments are
                optional.
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
                  disabled={
                    !canManage ||
                    p.bankrupt ||
                    !validLoanAmount(loanAmount) ||
                    loanAmount === 0 ||
                    (!!game.marketState && !capacity.allowed)
                  }
                  onClick={() =>
                    dispatch({ type: "BORROW", amount: loanAmount })
                  }
                >
                  <Plus size={16} /> Borrow
                </button>
              </div>
              <p className="small muted">
                Adds {preciseMoney(capacity.interest)} to monthly expenses.
                Manage debt on your own turn; finish any worksheet before
                another transaction.
              </p>
              {game.marketState && (
                <p
                  className={`small ${!capacity.allowed ? "negative" : "muted"}`}
                  role="status"
                >
                  Current DTI:{" "}
                  {currentLending.income > 0
                    ? `${((currentLending.service / currentLending.income) * 100).toFixed(2)}%`
                    : "no qualifying income"}
                  . After this loan:{" "}
                  {Number.isFinite(capacity.ratio)
                    ? `${(capacity.ratio * 100).toFixed(2)}%`
                    : "no qualifying income"}{" "}
                  / 55% limit.
                  {!capacity.allowed && " Loan declined."} Counts investment
                  mortgage payments and bank/purchase-loan interest; starting
                  role debt is excluded. Income is salary plus passive income
                  after operating costs and mortgage financing.
                </p>
              )}
            </div>
          )}
        </section>
      )}
      {tab === "ledger" && (
        <TransactionLedger key={p.id} game={game} player={p} />
      )}
      {tab === "results" && <GameReview game={game} />}
    </div>
  );
}
