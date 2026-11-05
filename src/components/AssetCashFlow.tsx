import { assetIncomeBreakdown, economicEvents } from "../game/economy";
import { preciseMoney } from "../game/engine";
import type { Asset, GameState } from "../game/types";

export default function AssetCashFlow({
  game,
  asset,
  collapsible = false,
}: {
  game: GameState;
  asset: Asset;
  collapsible?: boolean;
}) {
  const { operating, financing, net } = assetIncomeBreakdown(game, asset),
    effects = game.economy.active.flatMap((active) => {
      const event = economicEvents.find((e) => e.id === active.card);
      if (!event) return [];
      const changes = [
        event.income?.[asset.category] !== undefined &&
        event.income[asset.category] !== 1
          ? `operating income ×${event.income[asset.category]}`
          : "",
        asset.financing > 0 &&
        event.loanPayments !== undefined &&
        event.loanPayments !== 1
          ? `financing ×${event.loanPayments}`
          : "",
      ].filter(Boolean);
      return changes.length
        ? [{ ...active, name: event.name, changes: changes.join(", ") }]
        : [];
    });
  if (!asset.financing && !effects.length) return null;
  const content = (
    <div className="asset-cash-flow">
      <dl>
        <div>
          <dt>Income after operating costs</dt>
          <dd>{preciseMoney(operating)}/mo</dd>
        </div>
        <div>
          <dt>Financing payment</dt>
          <dd>−{preciseMoney(financing)}/mo</dd>
        </div>
        <div className="asset-cash-flow-total">
          <dt>Net passive income</dt>
          <dd className={net < 0 ? "negative" : ""}>{preciseMoney(net)}/mo</dd>
        </div>
      </dl>
      {effects.map((effect) => (
        <p key={`${effect.card}-${effect.start}`}>
          <b>{effect.name}</b>: {effect.changes}. Active through round{" "}
          {effect.expires - 1}.
        </p>
      ))}
      {effects.length > 0 && (
        <p>Without temporary events: {preciseMoney(asset.income)}/mo, net.</p>
      )}
      {net < 0 && (
        <p className="negative">
          Negative cash flow: this investment currently costs{" "}
          {preciseMoney(-net)} each month.
        </p>
      )}
      <p>Financing is already deducted here, before household expenses.</p>
    </div>
  );
  return collapsible ? (
    <details className="asset-cash-flow-details">
      <summary>Monthly income breakdown</summary>
      {content}
    </details>
  ) : (
    content
  );
}
