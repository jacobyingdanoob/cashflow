import {
  economicEvents,
  installment,
  requiredReserve,
  FIRST_ECONOMIC_ROUND,
  ECONOMIC_INTERVAL,
} from "../game/economy";
import { preciseMoney } from "../game/engine";
import type { GameState } from "../game/types";
import EncyclopediaCards from "./EncyclopediaCards";
export function EconomyBanner({
  game,
  onOpen,
}: {
  game: GameState;
  onOpen: () => void;
}) {
  return (
    <div className="economy-banner">
      <div>
        <strong>City economy</strong>
        <span>
          {game.economy.active.length
            ? game.economy.active
                .map(
                  (a) =>
                    `${economicEvents.find((c) => c.id === a.card)!.name} · through round ${a.expires - 1}`,
                )
                .join(" / ")
            : game.config.economicCycles
              ? game.round < FIRST_ECONOMIC_ROUND
                ? `Opening grace period · first cycle in round ${FIRST_ECONOMIC_ROUND}`
                : "Stable conditions · a new cycle every 3 rounds"
              : "Economic cycles off"}
        </span>
      </div>
      <button className="text-button" onClick={onOpen}>
        Economic events & rules →
      </button>
    </div>
  );
}
export default function EconomicEvents({ game }: { game: GameState }) {
  const p = game.players[0];
  return (
    <div className="economic-catalog">
      <p className="muted">
        Original game scenarios inspired by real economic conditions. Their
        percentages are simplified playtest rules, not historical measurements
        or predictions. All players and both tracks face the same conditions.
      </p>
      <div className="economic-rule-grid">
        <article>
          <h3>Liquidity risk</h3>
          <p>
            {game.config.liquidityRisk ? "Enabled" : "Disabled"}. At the start
            and end of a turn, cash must cover 10% of total debt, including
            investment mortgages. A crisis requires forced sales at 50% of
            current equity; associated financing is settled and income is lost.
            Unresolved bankruptcy eliminates the player.
          </p>
          <p>
            New games add the opening reserve to profession cash. Existing saves
            keep their cash. Bankruptcy recovery receives three turns without
            another liquidity call. Warning hints appear only with automatic
            accounting.
          </p>
          <strong>
            Your reserve requirement: {preciseMoney(requiredReserve(p))}
          </strong>
        </article>
        <article>
          <h3>Principal and interest</h3>
          <p>
            Principal repayments are optional and autopay is off by default.
            {game.config.principalRate > 0
              ? ` This match opted into ${game.config.principalRate}% autopay at each player’s turn end, for household debt, bank loans, and investment mortgages.`
              : " This match has no scheduled principal payment. Repay custom amounts in Loans & debt when you choose."}{" "}
            Principal reduces cash and liabilities; it is paid separately from
            recurring expenses and is never deducted again at Payday.
          </p>
          <p>
            Custom repayments accept cents. Remaining payments decrease in
            proportion to the outstanding principal. Investment financing
            savings increase net passive income, since that financing was
            already deducted there.
          </p>
          <strong>
            Your next principal payment:{" "}
            {preciseMoney(installment(p, game.config.principalRate))}
          </strong>
        </article>
      </div>
      <EncyclopediaCards enabled={game.config.adaptedCards} />
      <p className="cycle-timing">
        No sudden economic events occur during rounds 1–10. The first seeded
        cycle starts in round {FIRST_ECONOMIC_ROUND}, then every{" "}
        {ECONOMIC_INTERVAL} rounds (11, 14, 17…). Each lasts three rounds.
        Conditions normalize before the next draw. Price changes affect existing
        holdings, new purchases, eligible sale offers, and distress equity.
        Market repricing is posted together for everyone; cash transactions
        still use your chosen accounting mode.
      </p>
      {(["positive", "negative"] as const).map((tone) => (
        <section key={tone}>
          <h3>
            {tone === "positive" ? "Positive events" : "Negative events"}{" "}
            <small>8 cards</small>
          </h3>
          <div className="economic-event-grid">
            {economicEvents
              .filter((c) => c.tone === tone)
              .map((c) => (
                <article className={`economic-card ${tone}`} key={c.id}>
                  <span className="eyebrow">
                    {tone.toUpperCase()} · {c.duration} ROUNDS
                  </span>
                  <h4>{c.name}</h4>
                  <p>{c.description}</p>
                  <dl>
                    <dt>In-game relationship</dt>
                    <dd>{c.affected}</dd>
                    <dt>Real-life parallel</dt>
                    <dd>{c.scenario}</dd>
                  </dl>
                  <a href={c.source.url} target="_blank" rel="noreferrer">
                    {c.source.label} ↗
                  </a>
                </article>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
