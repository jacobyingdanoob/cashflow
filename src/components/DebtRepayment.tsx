import { useState } from "react";
import { debtPayment, factor } from "../game/economy";
import { preciseMoney } from "../game/engine";
import type { Debt, Asset, GameState, GameAction, Player } from "../game/types";
export default function DebtRepayment({
  game,
  debt,
  asset,
  disabled,
  dispatch,
  player,
  readOnly = false,
}: {
  game: GameState;
  debt?: Debt;
  asset?: Asset;
  disabled: boolean;
  dispatch: (a: GameAction) => void;
  player?: Player;
  readOnly?: boolean;
}) {
  const p = player ?? game.players[0],
    id = debt?.id ?? asset!.id,
    name = debt?.name ?? `${asset!.name} mortgage`,
    balance = debt?.principal ?? asset!.mortgage;
  const [value, setValue] = useState(
    String(Math.min(100000, balance, p.cash) / 100),
  );
  const amount = Math.round(Number(value) * 100),
    valid =
      value.trim() !== "" &&
      Number.isFinite(Number(value)) &&
      amount > 0 &&
      amount <= Math.min(balance, p.cash);
  const payment = debt
    ? debtPayment(game, debt)
    : Math.round(asset!.financing * factor(game, "loanPayments"));
  const remaining = valid ? balance - amount : balance;
  const basis = debt?.paymentBasis ??
    asset?.financingBasis ?? {
      principal: balance,
      payment: debt?.payment ?? asset!.financing,
    };
  const nextBase = remaining
    ? Math.round((basis.payment * remaining) / basis.principal)
    : 0;
  const nextPayment =
    debt && (debt.kind === "bank" || debt.kind === "purchase")
      ? debtPayment(game, { ...debt, principal: remaining })
      : Math.round(nextBase * factor(game, "loanPayments"));
  return (
    <div className="repayment-card">
      <div className="repayment-title">
        <div>
          <h4>{name}</h4>
          <small>
            {preciseMoney(payment)} / month
            {debt?.monthlyRateBps !== undefined
              ? ` · ${debt.monthlyRateBps / 100}% monthly`
              : debt?.kind === "bank"
                ? ` · ${game.config.annualRate}% annual (existing loan)`
                : ""}
            {asset ? " · already included in net investment income" : ""}
          </small>
        </div>
        <strong>{preciseMoney(balance)}</strong>
      </div>
      {!readOnly && (
        <>
          <div className="repayment-controls">
            <label className="form-field">
              Repayment ($)
              <input
                aria-label={`Repayment amount for ${name}`}
                type="number"
                min="0.01"
                step="0.01"
                max={Math.min(balance, p.cash) / 100}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>
            <button
              className="button secondary small-button"
              disabled={disabled || !valid}
              onClick={() => dispatch({ type: "REPAY", debtId: id, amount })}
            >
              Repay
            </button>
            <button
              className="text-button"
              disabled={disabled || p.cash < balance}
              onClick={() =>
                dispatch({ type: "REPAY", debtId: id, amount: balance })
              }
            >
              Pay off
            </button>
          </div>
          <p className="repayment-preview">
            Monthly payment: {preciseMoney(payment)} →{" "}
            {preciseMoney(nextPayment)}
            {asset
              ? ` · Net passive income increases by ${preciseMoney(payment - nextPayment)}`
              : ""}
          </p>
          {value !== "" && !valid && (
            <p className="inline-error">
              Enter an amount from $0.01 to{" "}
              {preciseMoney(Math.min(balance, p.cash))}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
