import { useState } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import {
  activeMarketTrend,
  marketTrends,
  trendRate,
  cycleRange,
} from "../game/trends";
import { marketCategories, marketLabels } from "../game/market";
import type { GameState, MarketTrend } from "../game/types";
import Modal from "./Modal";
export function TrendDetails({ card }: { card: MarketTrend }) {
  return (
    <>
      <p>{card.description}</p>
      <dl className="trend-rates">
        {marketCategories.map((category) => (
          <div key={category}>
            <dt>{marketLabels[category]} baseline</dt>
            <dd>
              {cycleRange(card, category)
                ? trendRate(cycleRange(card, category)!)
                : "Ordinary fluctuations continue"}
            </dd>
          </div>
        ))}
      </dl>
      <p>
        Actual movement adds ordinary noise and a pull toward 100%. A market in
        depression keeps fluctuating below 35% for its remaining 5–10-round
        lock; its cycle force pauses until the lock expires.
      </p>
      <p>{card.scenario}</p>
      <p className="small muted">
        Simplified game assumptions, not historical measurements. These effects
        change asset values, new purchase prices, and relevant business/stock
        operating income. Mortgage balances and financing payments remain
        unchanged. Market landings can add a separate shock during a trend.
      </p>
      <a href={card.source.url} target="_blank" rel="noreferrer">
        Economic reference: {card.source.label} ↗
      </a>
    </>
  );
}
export function TrendBadge({ game }: { game: GameState }) {
  const active = activeMarketTrend(game);
  const [opened, setOpened] = useState<
    { card: MarketTrend; start: number; expires: number } | "calm" | null
  >(null);
  if (!game.marketState) return null;
  return (
    <>
      <button
        className={`trend-badge ${active?.definition.tone ?? "calm"}`}
        onClick={() =>
          setOpened(
            active
              ? {
                  card: active.definition,
                  start: active.start,
                  expires: active.expires,
                }
              : "calm",
          )
        }
        aria-label={
          active
            ? `Market trend: ${active.definition.name}, rounds ${active.start}–${active.expires - 1}. View details`
            : "Calm markets. View round movement rules"
        }
      >
        <TrendingUp size={13} />
        <span>
          {active
            ? `${active.definition.name} · ${active.expires - game.round}r`
            : "Calm markets"}
        </span>
        <ChevronRight size={12} />
      </button>
      {opened && (
        <Modal
          title={opened === "calm" ? "Between market trends" : opened.card.name}
          eyebrow="ECONOMIC MARKET TREND"
          onClose={() => setOpened(null)}
        >
          <div className="market-trend-details">
            {opened === "calm" ? (
              <>
                <p>
                  Each new round draws an independent fluctuation in every
                  market, including during economic cycles:
                </p>
                <ul>
                  <li>Real estate: −0.25% to +0.25%.</li>
                  <li>Businesses: −1% to +1%.</li>
                  <li>
                    Stocks: either −3% to −2%, or +2% to +3%, with equal
                    direction odds.
                  </li>
                </ul>
                <p>
                  {game.config.economicCycles
                    ? "A seeded economic card is drawn every five rounds, starting in round 5. Each adds three rounds of stronger changes, with a tendency toward 100% at extreme prices."
                    : "Economic trends are disabled for this match; ordinary movements continue every round."}
                </p>
                <p>
                  All changes compound. Expiry stops a trend's future changes
                  and does not undo its price effect. Below 50%, a shared random
                  discount offer follows the completion of market-space sale
                  responses. Below 35%, a market enters a 5–10-round depression
                  and continues fluctuating under that ceiling.
                </p>
              </>
            ) : (
              <>
                <p className="trend-duration">
                  Rounds {opened.start}–{opened.expires - 1} · three
                  applications
                </p>
                <TrendDetails card={opened.card} />
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
export function TrendCatalogue({ game }: { game: GameState }) {
  const active = activeMarketTrend(game);
  return (
    <details className="trend-catalogue">
      <summary>
        Economic trends · {active?.definition.name ?? "between trends"}
      </summary>
      <p>
        Draws: rounds 5, 10, 15… Each lasts three rounds, including its draw
        round.{" "}
        {game.config.economicCycles
          ? "Enabled for this match."
          : "Disabled for this match."}
      </p>
      {marketTrends.map((card) => (
        <details key={card.id}>
          <summary>
            {card.name} · {card.duration} rounds
          </summary>
          <TrendDetails card={card} />
        </details>
      ))}
    </details>
  );
}
