import { useId, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Flag,
  GraduationCap,
  LineChart,
  Sparkles,
} from "lucide-react";
import { money, preciseMoney, playerFinancials } from "../game/engine";
import {
  coaching,
  coachingRisk,
  playerHistory,
  personalReviewState,
} from "../game/review";
import type {
  FinancialHistoryPoint,
  Financials,
  GameState,
} from "../game/types";
export const chartMetrics: [keyof Financials, string][] = [
  ["passive", "Passive income"],
  ["debt", "Total debt"],
  ["cash", "Cash on hand"],
  ["flow", "Monthly cash flow"],
  ["expenses", "Monthly expenses"],
  ["netWorth", "Net worth"],
];
const monthly = new Set<keyof Financials>(["passive", "flow", "expenses"]);
function FinancialChart({
  game,
  metric,
  visible,
}: {
  game: GameState;
  metric: keyof Financials;
  visible: string[];
}) {
  const [selected, setSelected] = useState<FinancialHistoryPoint | null>(null),
    clip = useId().replace(/:/g, "");
  const points = useMemo(
    () =>
      game.history
        .filter((h) => visible.includes(h.player))
        .sort((a, b) => a.id - b.id),
    [game.history, visible],
  );
  const label = chartMetrics.find(([key]) => key === metric)![1];
  const w = 600,
    h = 270,
    pad = { left: 70, right: 20, top: 22, bottom: 37 };
  const start = game.history.reduce((n, p) => Math.min(n, p.id), Infinity),
    end = Math.max(
      start + 1,
      game.history.reduce((n, p) => Math.max(n, p.id), 0),
    );
  const low = Math.min(0, ...points.map((p) => p.values[metric])),
    maximum = Math.max(0, ...points.map((p) => p.values[metric])),
    high = maximum > low ? maximum : low + 100000;
  const x = (id: number) =>
      pad.left + ((id - start) / (end - start)) * (w - pad.left - pad.right),
    y = (value: number) =>
      pad.top + ((high - value) / (high - low)) * (h - pad.top - pad.bottom);
  const lines = game.players
    .filter((p) => visible.includes(p.id))
    .map((p) => ({
      player: p,
      points: points.filter((point) => point.player === p.id),
    }));
  const selectedPlayer = game.players.find((p) => p.id === selected?.player);
  function pointer(e: React.PointerEvent<SVGSVGElement>) {
    const bounds = e.currentTarget.getBoundingClientRect(),
      px = ((e.clientX - bounds.left) / bounds.width) * w,
      py = ((e.clientY - bounds.top) / bounds.height) * h;
    const closest = points.reduce<FinancialHistoryPoint | null>(
      (best, p) =>
        !best ||
        Math.hypot(x(p.id) - px, y(p.values[metric]) - py) <
          Math.hypot(x(best.id) - px, y(best.values[metric]) - py)
          ? p
          : best,
      null,
    );
    setSelected(closest);
  }
  function key(e: React.KeyboardEvent<SVGSVGElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setSelected(null);
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = points.findIndex((p) => p.id === selected?.id);
    setSelected(
      points[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? points.length - 1
            : Math.max(
                0,
                Math.min(
                  points.length - 1,
                  i + (e.key === "ArrowRight" ? 1 : -1),
                ),
              )
      ] ?? null,
    );
  }
  return (
    <section className="history-chart" aria-label={`${label} history`}>
      <div className="chart-heading">
        <h4>{label}</h4>
        <span>{monthly.has(metric) ? "USD / month" : "USD"}</span>
      </div>
      <div className="chart-canvas">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          tabIndex={0}
          role="group"
          aria-label={`${label} chart. Hover or tap to inspect changes. Use left and right arrows to explore recorded events.`}
          onPointerMove={pointer}
          onPointerDown={pointer}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setSelected(null);
          }}
          onFocus={() => setSelected(points[0] ?? null)}
          onBlur={() => setSelected(null)}
          onKeyDown={key}
        >
          <defs>
            <clipPath id={clip}>
              <rect
                x={pad.left - 3}
                y={pad.top - 3}
                width={w - pad.left - pad.right + 6}
                height={h - pad.top - pad.bottom + 6}
              />
            </clipPath>
          </defs>
          {[0, 1, 2, 3].map((i) => {
            const value = low + ((high - low) * i) / 3;
            return (
              <g key={i}>
                <line
                  x1={pad.left}
                  x2={w - pad.right}
                  y1={y(value)}
                  y2={y(value)}
                  stroke="#dfe6d6"
                  strokeDasharray="3 5"
                />
                <text
                  x={pad.left - 10}
                  y={y(value) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#637253"
                >
                  {money(value, true)}
                </text>
              </g>
            );
          })}
          {[0, 1, 2].map((i) => {
            const id = start + ((end - start) * i) / 2,
              closest = game.history.reduce(
                (best, p) =>
                  Math.abs(p.id - id) < Math.abs(best.id - id) ? p : best,
                game.history[0],
              );
            return (
              <text
                key={i}
                x={x(id)}
                y={h - 12}
                textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
                fontSize="11"
                fill="#637253"
              >
                Round{" "}
                {Math.min(
                  closest?.round ?? game.round,
                  game.config.roundLimit || game.round,
                )}
              </text>
            );
          })}
          <g clipPath={`url(#${clip})`}>
            {lines.map(({ player, points: series }, i) => {
              if (!series.length) return null;
              const path =
                `M${x(start)},${y(series[0].values[metric])}` +
                series
                  .map((p) => `H${x(p.id)}V${y(p.values[metric])}`)
                  .join("") +
                `H${x(end)}`;
              return (
                <path
                  key={player.id}
                  d={path}
                  fill="none"
                  stroke={player.color}
                  strokeWidth="2.6"
                  strokeLinejoin="round"
                  strokeDasharray={
                    i === 0
                      ? undefined
                      : i % 3 === 1
                        ? "7 3"
                        : i % 3 === 2
                          ? "3 3"
                          : "10 3 2 3"
                  }
                />
              );
            })}
          </g>
          {selected && visible.includes(selected.player) && (
            <g>
              <line
                x1={x(selected.id)}
                x2={x(selected.id)}
                y1={pad.top}
                y2={h - pad.bottom}
                stroke="#8da37d"
                strokeDasharray="4 4"
              />
              <circle
                cx={x(selected.id)}
                cy={y(selected.values[metric])}
                r="5"
                fill={selectedPlayer?.color}
                stroke="#fffdf5"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
        {selected && visible.includes(selected.player) && (
          <div className="chart-tooltip" role="status">
            <strong>
              {selectedPlayer?.name} · Round {selected.round}
            </strong>
            <span>{selected.title}</span>
            <b>
              {preciseMoney(selected.values[metric])}
              {monthly.has(metric) ? " /mo" : ""}
            </b>
            {selected.delta[metric] !== undefined && (
              <span>
                {preciseMoney(
                  selected.values[metric] - (selected.delta[metric] ?? 0),
                )}{" "}
                → {preciseMoney(selected.values[metric])} (
                {(selected.delta[metric] ?? 0) >= 0 ? "+" : ""}
                {preciseMoney(selected.delta[metric] ?? 0)})
              </span>
            )}
            {selected.note && <small>{selected.note}</small>}
          </div>
        )}
      </div>
    </section>
  );
}
export default function GameReview({
  game,
  personal = false,
}: {
  game: GameState;
  personal?: boolean;
}) {
  return (
    <ReviewContent
      game={personal ? personalReviewState(game) : game}
      personal={personal}
    />
  );
}
function ReviewContent({
  game,
  personal,
}: {
  game: GameState;
  personal: boolean;
}) {
  const [visible, setVisible] = useState(game.players.map((p) => p.id)),
    [metrics, setMetrics] = useState<(keyof Financials)[]>([
      "passive",
      "debt",
      "cash",
      "flow",
    ]),
    [coachPlayer, setCoachPlayer] = useState("p0");
  const tips = useMemo(() => coaching(game, coachPlayer), [game, coachPlayer]);
  const history = useMemo(
    () => playerHistory(game, coachPlayer),
    [game, coachPlayer],
  );
  const p = game.players.find((p) => p.id === coachPlayer)!,
    f = playerFinancials(game, p),
    risk = coachingRisk(game, coachPlayer),
    start = history[0]?.values ?? f;
  const rounds = Math.min(game.round, game.config.roundLimit || game.round);
  const winners = game.players.filter((p) => game.winners.includes(p.id));
  const outcome = personal
    ? `Your game ended in round ${rounds}.`
    : winners.length > 1
      ? `${winners.map((p) => p.name).join(", ")} share the win.`
      : winners.length === 1
        ? `${winners[0].human ? "You" : winners[0].name} won the game.`
        : "The game is complete.";
  return (
    <section className="game-review">
      <div className="review-intro">
        <div className="review-icon">
          <Flag size={26} />
        </div>
        <div>
          <span className="eyebrow">YOUR STORY IN NUMBERS</span>
          <h3>{outcome}</h3>
          <p>{game.finishReason}</p>
        </div>
      </div>
      <div className="review-topline">
        <div>
          <span>Rounds played</span>
          <strong>{rounds}</strong>
        </div>
        <div>
          <span>Financial events recorded</span>
          <strong>
            {game.history.filter((h) => h.kind === "transaction").length}
          </strong>
        </div>
        <div>
          <span>Reached the Fast Track</span>
          <strong>
            {game.players.filter((p) => p.stage === "fast").length}
            <small> / {game.players.length}</small>
          </strong>
        </div>
      </div>
      {game.history.some((h) => h.title === "History tracking started") && (
        <p className="history-migration-note">
          This saved match was started before history tracking was added. Charts
          and coaching cover the recorded portion beginning in round{" "}
          {game.historyStartRound}; earlier changes cannot be reconstructed.
        </p>
      )}
      <section className="review-journey">
        <div className="review-section-heading">
          <div>
            <h3>
              <LineChart size={18} /> Every turn left a trace.
            </h3>
            <p>
              Hover or tap a line to see what changed and why. Keyboard: focus a
              chart, then use ← and →.
            </p>
          </div>
        </div>
        <div
          className="chart-player-legend"
          aria-label="Players shown on charts"
        >
          {game.players.map((p) => (
            <button
              key={p.id}
              aria-pressed={visible.includes(p.id)}
              onClick={() =>
                setVisible((v) =>
                  v.includes(p.id)
                    ? v.length > 1
                      ? v.filter((id) => id !== p.id)
                      : v
                    : [...v, p.id],
                )
              }
            >
              <i style={{ background: p.color }} />
              {p.name}
              {game.winners.includes(p.id) && <Sparkles size={12} />}
            </button>
          ))}
        </div>
        <fieldset className="chart-metric-controls">
          <legend>Financial measures</legend>
          {chartMetrics.map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={metrics.includes(key)}
                onChange={() =>
                  setMetrics((v) =>
                    v.includes(key) ? v.filter((m) => m !== key) : [...v, key],
                  )
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
        <div className="history-chart-grid">
          {metrics.length ? (
            metrics.map((metric) => (
              <FinancialChart
                key={metric}
                game={game}
                metric={metric}
                visible={visible}
              />
            ))
          ) : (
            <p className="muted">
              Choose a financial measure to draw its history.
            </p>
          )}
        </div>
      </section>
      <div
        className="review-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={
          personal
            ? "Your financial position at exit"
            : "Final player comparison"
        }
      >
        <table className="review-scoreboard">
          <caption>
            {personal
              ? "Your financial journey"
              : "Everyone’s financial journey"}
          </caption>
          <thead>
            <tr>
              <th>Player</th>
              <th>Passive income / mo</th>
              <th>Total debt</th>
              <th>Freedom</th>
              <th>{personal ? "Net worth at exit" : "Final net worth"}</th>
            </tr>
          </thead>
          <tbody>
            {game.players.map((p) => {
              const final = playerFinancials(game, p),
                first = playerHistory(game, p.id)[0]?.values ?? final;
              return (
                <tr key={p.id}>
                  <th>
                    <span
                      className="scoreboard-player-dot"
                      style={{ background: p.color }}
                    />
                    {p.name}
                    {game.winners.includes(p.id) ? " ✦" : ""}
                    {p.eliminated && <small>Eliminated</small>}
                  </th>
                  <td>
                    {money(first.passive)} <span>→</span> {money(final.passive)}
                  </td>
                  <td>
                    {money(first.debt)} <span>→</span> {money(final.debt)}
                  </td>
                  <td>
                    {Math.round(
                      (final.passive / Math.max(1, final.expenses)) * 100,
                    )}
                    %
                  </td>
                  <td>{money(final.netWorth)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <section className="game-coach">
        <div className="review-section-heading">
          <div>
            <h3>
              <GraduationCap size={21} /> A word from your game coach.
            </h3>
            <p>
              Debt, liquidity and shock resilience, grounded in recorded
              decisions. Required reserves and emergency cash are counted
              separately.
            </p>
          </div>
          <label className="form-field">
            Review player
            <select
              value={coachPlayer}
              onChange={(e) => setCoachPlayer(e.target.value)}
            >
              {game.players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="coach-player-stats">
          <span>
            Cash on hand <strong>{preciseMoney(f.cash)}</strong>
          </span>
          <span>
            Total debt <strong>{preciseMoney(f.debt)}</strong>
          </span>
          <span>
            Required reserve
            <strong>{preciseMoney(risk.reserve)}</strong>
            <small>
              {game.config.liquidityRisk
                ? "10% of total debt"
                : "Reserve rule off"}
            </small>
          </span>
          <span
            className={
              risk.bufferAfterPrincipal < risk.safetyBuffer
                ? "coach-risk"
                : undefined
            }
          >
            {game.config.liquidityRisk
              ? "Cash above required reserve"
              : "Cash available for shocks"}
            <strong>{preciseMoney(risk.buffer)}</strong>
            <small>
              {risk.buffer < 0
                ? game.config.liquidityRisk
                  ? "Below required reserve"
                  : "Cash deficit"
                : risk.buffer < risk.safetyBuffer
                  ? "Below coaching buffer target"
                  : risk.bufferAfterPrincipal < risk.safetyBuffer
                    ? "Thin buffer after opted-in principal"
                    : "Above coaching buffer target"}
            </small>
          </span>
          <span>
            Passive income{" "}
            <strong>
              {money(start.passive)} → {money(f.passive)}
            </strong>
          </span>
          <span>
            Monthly expenses{" "}
            <strong>
              {money(start.expenses)} → {money(f.expenses)}
            </strong>
          </span>
        </div>
        <div className="coach-tips">
          {tips.map((t) => (
            <article className={`coach-tip ${t.tone}`} key={t.id}>
              <div className="coach-tip-heading">
                {t.tone === "strength" ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <ChevronRight size={18} />
                )}
                <div>
                  <span>
                    {t.tone === "strength" ? "WHAT WORKED" : "SOMETHING TO TRY"}
                  </span>
                  <h4>{t.title}</h4>
                </div>
              </div>
              <p>{t.evidence}</p>
              <div className="coach-next-step">{t.suggestion}</div>
            </article>
          ))}
        </div>
      </section>
      <details className="review-event-history">
        <summary>
          Explore {p.name === "You" ? "your" : `${p.name}’s`} recorded events
        </summary>
        <div
          className="review-table-scroll"
          tabIndex={0}
          role="region"
          aria-label="Recorded financial events"
        >
          <table>
            <thead>
              <tr>
                <th>Round</th>
                <th>What happened</th>
                <th>Cash</th>
                <th>Passive / mo</th>
                <th>Debt</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id}>
                  <td>{h.round}</td>
                  <td>
                    <strong>{h.title}</strong>
                    <small>{h.note}</small>
                  </td>
                  <td>{preciseMoney(h.values.cash)}</td>
                  <td>{preciseMoney(h.values.passive)}</td>
                  <td>{preciseMoney(h.values.debt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="review-footnote">
        Coaching describes this game’s simplified economy. Investment values and
        net worth include current economic effects; cost basis remains recorded
        separately. Principal payments reduce cash and liabilities.
      </p>
    </section>
  );
}
