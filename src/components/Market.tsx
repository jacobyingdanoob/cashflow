import { useState, type PointerEvent } from "react";
import {
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Minus,
  TrendingUp,
} from "lucide-react";
import { deals } from "../game/content";
import { assetIncome, assetValue, effectiveDeal } from "../game/economy";
import { money, preciseMoney } from "../game/engine";
import {
  marketCategories,
  marketIndex,
  marketLabels,
  purchaseQuote,
} from "../game/market";
import type { AssetCategory, GameState, MarketTick } from "../game/types";
import { roundMarketChange, activeDepression } from "../game/trends";
import { TrendCatalogue } from "./MarketTrend";
export function MarketChart({
  game,
  category,
}: {
  game: GameState;
  category: AssetCategory;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const ticks =
    game.marketState?.history.filter((t) => t.category === category) ?? [];
  const points = [
    {
      id: 0,
      round: 1,
      category,
      before: 10000,
      after: 10000,
      title: "Opening market",
      player: "",
      card: "",
    },
    ...ticks,
  ];
  const w = 700,
    h = 250,
    left = 18,
    right = 627,
    top = 22,
    bottom = 208,
    end = Math.max(2, game.round + 1),
    low = Math.max(0, Math.min(9000, ...points.map((p) => p.after)) - 1000),
    high = Math.max(11000, ...points.map((p) => p.after)) + 1000,
    x = (round: number) => left + ((round - 1) / (end - 1)) * (right - left),
    y = (price: number) =>
      bottom - ((price - low) / (high - low)) * (bottom - top),
    pointX = points.map((p, i) =>
      i === 0
        ? left
        : x(
            p.round +
              points.slice(1, i + 1).filter((other) => other.round === p.round)
                .length /
                (ticks.filter((other) => other.round === p.round).length + 1),
          ),
    ),
    point = selected === null ? null : points[selected],
    path =
      `M${x(1)},${y(10000)}` +
      ticks.map((t, i) => `L${pointX[i + 1]},${y(t.after)}`).join("") +
      `H${right}`;
  function inspect(e: PointerEvent<SVGSVGElement>) {
    const bounds = e.currentTarget.getBoundingClientRect(),
      px = ((e.clientX - bounds.left) / bounds.width) * w,
      py = ((e.clientY - bounds.top) / bounds.height) * h;
    let best = 0;
    for (let i = 1; i < points.length; i++)
      if (
        Math.hypot(pointX[i] - px, y(points[i].after) - py) <
        Math.hypot(pointX[best] - px, y(points[best].after) - py)
      )
        best = i;
    setSelected(best);
  }
  return (
    <section
      className="market-chart"
      aria-label={`${marketLabels[category]} price history`}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        role="group"
        tabIndex={0}
        aria-label={`${marketLabels[category]} market chart. Right axis: percentage of opening price. Bottom axis: rounds. Use arrow keys to inspect event markers.`}
        onFocus={() => setSelected(points.length - 1)}
        onBlur={() => setSelected(null)}
        onKeyDown={(e) => {
          if (
            ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(e.key)
          ) {
            e.preventDefault();
            e.stopPropagation();
            setSelected(
              e.key === "Escape"
                ? null
                : e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? points.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          points.length - 1,
                          (selected ?? 0) + (e.key === "ArrowRight" ? 1 : -1),
                        ),
                      ),
            );
          }
        }}
        onPointerMove={inspect}
        onPointerDown={inspect}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") setSelected(null);
        }}
      >
        {[0, 1, 2, 3, 4].map((i) => {
          const value = low + ((high - low) * i) / 4;
          return (
            <g key={i}>
              <line
                x1={left}
                x2={right}
                y1={y(value)}
                y2={y(value)}
                stroke="#dfe8df"
                strokeDasharray="3 5"
              />
              <text
                x={right + 12}
                y={y(value) + 4}
                fill="#4b6258"
                fontSize="12"
              >
                {(value / 100).toFixed(0)}%
              </text>
            </g>
          );
        })}
        <line
          x1={left}
          x2={right}
          y1={y(10000)}
          y2={y(10000)}
          stroke="#b29756"
          strokeDasharray="5 5"
        />
        <path
          d={path}
          fill="none"
          stroke="#24675b"
          strokeWidth="2.8"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.id}
            cx={pointX[i]}
            cy={y(p.after)}
            r={selected === i ? 5.5 : 3.4}
            fill={p.after < p.before ? "#a74b3c" : "#24675b"}
            stroke="#fffdf5"
            strokeWidth="1.5"
          >
            <title>{`Round ${p.round}: ${p.title}, ${(p.after / 100).toFixed(2)}%`}</title>
          </circle>
        ))}
        {[1, Math.max(1, Math.round(game.round / 2)), game.round].map(
          (round, i) => (
            <text
              key={i}
              x={i === 0 ? left : i === 2 ? right : (left + right) / 2}
              y={h - 15}
              fill="#4b6258"
              fontSize="12"
              textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
            >
              Round {round}
            </text>
          ),
        )}
      </svg>
      <div className="market-inspector" role="status">
        {point ? (
          <>
            <strong>
              Round {point.round} · {point.title}
            </strong>
            <span>
              {(point.before / 100).toFixed(2)}% →{" "}
              {(point.after / 100).toFixed(2)}%
              {point.player &&
                ` · ${game.players.find((p) => p.id === point.player)?.name}`}
            </span>
          </>
        ) : (
          <>
            <strong>100% = opening price</strong>
            <span>Hover, tap or use the arrow keys to inspect markers.</span>
          </>
        )}
      </div>
    </section>
  );
}
function Change({ game, tick }: { game: GameState; tick: MarketTick }) {
  const change = (tick.after / tick.before - 1) * 100;
  return (
    <div className="market-change">
      <span className={change < 0 ? "market-fall" : "market-rise"}>
        {change >= 0 ? "+" : ""}
        {change.toFixed(1)}%
      </span>
      <div>
        <strong>{tick.title}</strong>
        <small>
          Round {tick.round} ·{" "}
          {tick.player
            ? game.players.find((p) => p.id === tick.player)?.name
            : tick.source === "trend"
              ? "Economic trend"
              : "Round movement"}{" "}
          · {(tick.before / 100).toFixed(1)}% → {(tick.after / 100).toFixed(1)}%
        </small>
      </div>
    </div>
  );
}
export function MarketChanges({
  game,
  onOpen,
  compact = false,
}: {
  game: GameState;
  onOpen: () => void;
  compact?: boolean;
}) {
  const history =
    game.marketState?.history
      .slice()
      .reverse()
      .slice(0, compact ? 2 : 5) ?? [];
  return (
    <section
      className={`market-changes ${compact ? "compact" : ""}`}
      aria-label={compact ? "Market watch" : "Latest market changes"}
    >
      <div className="minor-heading">
        <h2>{compact ? "Market watch" : "Latest market changes"}</h2>
        <button
          className="text-button"
          onClick={onOpen}
          aria-label="Open all markets"
        >
          <ArrowUpRight size={16} />
        </button>
      </div>
      {!compact &&
        (history.length ? (
          history.map((tick) => (
            <Change key={tick.id} tick={tick} game={game} />
          ))
        ) : (
          <p className="small muted">
            Markets open at 100%. Round movements and market shocks set prices.
          </p>
        ))}
      {compact && (
        <div
          className="market-ticker"
          aria-label={`Round ${game.round} market changes`}
        >
          {marketCategories.map((c) => {
            const change = roundMarketChange(game, c),
              Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus;
            return (
              <button
                key={c}
                className={
                  change < 0
                    ? "market-fall"
                    : change > 0
                      ? "market-rise"
                      : "market-flat"
                }
                onClick={onOpen}
                aria-label={`${marketLabels[c]} ${change >= 0 ? "+" : ""}${change.toFixed(2)}% this round`}
              >
                <span>
                  {marketLabels[c]}
                  {activeDepression(game, c) && (
                    <small>
                      Depression ·{" "}
                      {activeDepression(game, c)!.expires - game.round}r
                    </small>
                  )}
                </span>
                <strong>
                  <Icon size={14} />
                  {change > 0 ? "+" : ""}
                  {change.toFixed(2)}%
                </strong>
              </button>
            );
          })}
        </div>
      )}
      {compact && (
        <p className="ticker-caption">
          Round {game.round} change · includes shocks
        </p>
      )}
    </section>
  );
}
export default function Market({ game }: { game: GameState }) {
  const [category, setCategory] = useState<AssetCategory>("stock");
  const depression = activeDepression(game, category);
  return (
    <div className="markets-page">
      <p className="muted">
        Three markets. One shared price for every investor. Round movements,
        multi-round economic trends and market-space shocks compound into
        prices.
      </p>
      {!game.marketState && (
        <p className="history-migration-note">
          This saved match uses legacy market rules. Start a new game for
          persistent prices and trading costs.
        </p>
      )}
      <div className="market-tabs" role="tablist" aria-label="Asset markets">
        {marketCategories.map((c) => (
          <button
            key={c}
            role="tab"
            id={`market-tab-${c}`}
            aria-controls="asset-market-panel"
            aria-selected={category === c}
            tabIndex={category === c ? 0 : -1}
            onClick={() => setCategory(c)}
            onKeyDown={(e) => {
              if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
                return;
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? marketCategories[0]
                  : e.key === "End"
                    ? marketCategories.at(-1)!
                    : marketCategories[
                        (marketCategories.indexOf(c) +
                          (e.key === "ArrowRight"
                            ? 1
                            : marketCategories.length - 1)) %
                          marketCategories.length
                      ];
              setCategory(next);
              document.getElementById(`market-tab-${next}`)?.focus();
            }}
          >
            <span>{marketLabels[c]}</span>
            <strong>{(marketIndex(game, c) * 100).toFixed(2)}%</strong>
            <small>of opening price</small>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="asset-market-panel"
        aria-labelledby={`market-tab-${category}`}
      >
        <h3>
          <TrendingUp size={18} /> {marketLabels[category]}
        </h3>
        {depression && (
          <div className="depression-banner" role="status">
            <strong>
              Market depression · {depression.expires - game.round} rounds
              remaining
            </strong>
            <p>
              Prices stay below 35% through round {depression.expires - 1}.
              Ordinary fluctuations continue; this market's economic trend force
              pauses. Market-space shocks respect the cap. Afterward, the cap
              lifts without resetting prices.
            </p>
          </div>
        )}
        <MarketChart
          key={`chart-${category}`}
          game={game}
          category={category}
        />
        <p className="small muted">
          Markers follow event order within each round. Connecting lines show
          the progression between recorded prices.
        </p>
        {game.marketState && game.marketState.indices[category] < 5000 && (
          <div className="discount-market">
            <strong>Shared discount offer · market below 50%</strong>
            <p>
              After all market-sale responses finish, a random asset from this
              market is offered to every eligible player. Each player chooses to
              buy or pass at the same price. The offer appears automatically in
              the game.
            </p>
          </div>
        )}
        {game.marketState && <TrendCatalogue game={game} />}
        <p className="small muted">
          {category === "property"
            ? "Repricing changes existing property values and new asking prices. Existing rental operating income stays fixed."
            : "Stock and business operating income move by 25% of the index change from 100%. At an 80% price index, operating income is 95% of baseline. Financing payments stay unchanged."}{" "}
          Indices stay within 10%–500% of opening prices.
        </p>
        <h4>Your exposure</h4>
        {game.players[0].assets.some((a) => a.category === category) ? (
          <div className="market-exposure">
            {game.players[0].assets
              .filter((a) => a.category === category)
              .map((a) => (
                <div key={a.id}>
                  <strong>{a.name}</strong>
                  <span>Value {preciseMoney(assetValue(game, a))}</span>
                  <span>
                    Net income {preciseMoney(assetIncome(game, a))}/mo
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="small muted">You have no holdings in this market.</p>
        )}
        <details className="market-catalogue">
          <summary>Current opportunity prices</summary>
          <div className="review-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Full price</th>
                  <th>Acquisition fee</th>
                  <th>Cash required</th>
                  <th>Net income / mo</th>
                </tr>
              </thead>
              <tbody>
                {deals
                  .filter(
                    (c) =>
                      c.category === category &&
                      (!c.source || game.config.adaptedCards),
                  )
                  .map((c) => {
                    const current = effectiveDeal(game, c),
                      q = purchaseQuote(
                        game,
                        current,
                        1,
                        false,
                        game.players[0],
                      );
                    return (
                      <tr key={c.id}>
                        <th>
                          {c.name}
                          {category === "stock" && " / share"}
                        </th>
                        <td>{money(q.price)}</td>
                        <td>{money(q.fee)}</td>
                        <td>{money(q.cash)}</td>
                        <td>
                          {preciseMoney(
                            assetIncome(game, {
                              ...q.deal,
                              id: "catalogue",
                              cardId: c.id,
                              shares: 1,
                            }),
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </details>
        <p className="small muted">
          Catalogue cash and income use your next down-payment tier. Type 1
          mortgage eligibility also depends on the 55% DTI test. Sales are
          available to eligible owners during a market response. A price decline
          can reduce net worth and income even when you hold. Below 50%,
          finishing all market-sale responses opens a shared random discounted
          asset offer. Each eligible player may buy once or pass. Below 35%, a
          seeded 5–10-round depression keeps the market below 35%, with
          continued fluctuations.
        </p>
      </div>
    </div>
  );
}
