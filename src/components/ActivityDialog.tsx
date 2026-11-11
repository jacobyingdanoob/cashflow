import { ArrowRight, ReceiptText, Dice5 } from "lucide-react";
import { economicEvents } from "../game/economy";
import { marketTrends } from "../game/trends";
import { TrendDetails } from "./MarketTrend";
import { markets, expenses } from "../game/content";
import CardSource from "./CardSource";
import Modal from "./Modal";
import { Avatar } from "./Board";
import { preciseMoney } from "../game/engine";
import type { ActivityNotice, Financials, GameState } from "../game/types";
const metrics: [keyof Financials, string][] = [
  ["cash", "Cash"],
  ["debt", "Total debt"],
  ["passive", "Passive income / mo"],
  ["expenses", "Expenses / mo"],
  ["flow", "Cash flow / mo"],
];
export default function ActivityDialog({
  notice,
  game,
  onDismiss,
}: {
  notice: ActivityNotice;
  game: GameState;
  onDismiss: () => void;
}) {
  const player = game.players.find((p) => p.id === notice.player)!;
  const card = economicEvents.find((c) => c.id === notice.eventId);
  const trend = marketTrends.find((c) => c.id === notice.eventId);
  const changes = notice.changes.filter((c) =>
    metrics.some(([key]) => c.before[key] !== c.after[key]),
  );
  return (
    <Modal
      title={notice.title}
      onClose={onDismiss}
      dismissOnBackdrop={false}
      eyebrow={
        notice.kind === "cycle"
          ? "ECONOMIC CYCLE"
          : notice.kind === "risk"
            ? "LIQUIDITY RISK"
            : notice.kind === "npc-turn"
              ? "AROUND THE TABLE"
              : "YOUR JOURNEY"
      }
      className={`event-details ${notice.kind} ${notice.tone ?? "neutral"}`}
    >
      <div className="activity-dialog">
        <div className="event-person">
          <Avatar player={player} size={48} />
          <div>
            <strong>{player.name}</strong>
            <span>
              Round {notice.round}
              {notice.dice.length ? ` · Rolled ${notice.dice.join(" + ")}` : ""}
            </span>
          </div>
          <span className="event-paused">Activity details</span>
        </div>
        <p className="event-description">{notice.description}</p>
        {trend && (
          <div className="cycle-reference">
            <strong>{trend.name} · 3 rounds</strong>
            <TrendDetails card={trend} />
          </div>
        )}
        <CardSource
          source={
            expenses.find((c) => c.name === notice.title)?.source ??
            markets.find((c) => c.name === notice.title)?.source
          }
        />
        {card && (
          <div className="cycle-reference">
            <strong>In-game relationship</strong>
            <p>{card.affected}</p>
            <a href={card.source.url} target="_blank" rel="noreferrer">
              Real-life reference: {card.source.label} ↗
            </a>
          </div>
        )}
        {notice.events.length > 0 && (
          <section className="event-story">
            <h3>
              <Dice5 size={16} /> What happened
            </h3>
            <ul>
              {notice.events.map((text, i) => (
                <li key={i}>{text.replace(`${player.name}: `, "")}</li>
              ))}
            </ul>
          </section>
        )}
        {changes.length > 0 ? (
          <section className="event-finances">
            <h3>
              <ReceiptText size={16} /> The financial effect
            </h3>
            {changes.map((c) => (
              <div key={c.player} className="event-player-changes">
                {(changes.length > 1 || c.player !== notice.player) && (
                  <h4>{game.players.find((p) => p.id === c.player)?.name}</h4>
                )}
                {metrics
                  .filter(([key]) => c.before[key] !== c.after[key])
                  .map(([key, label]) => {
                    const delta = c.after[key] - c.before[key];
                    return (
                      <div className="event-change" key={key}>
                        <span>{label}</span>
                        <div>
                          <strong>
                            {preciseMoney(c.before[key])} <span>→</span>{" "}
                            {preciseMoney(c.after[key])}
                          </strong>
                          <small>
                            {delta >= 0 ? "+" : ""}
                            {preciseMoney(delta)}
                          </small>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ))}
          </section>
        ) : (
          notice.kind === "npc-turn" && (
            <p className="event-no-change">
              No financial balances changed this turn.
            </p>
          )
        )}
        {notice.reasons.length > 0 && (
          <section className="event-reasons">
            <h3>Their thinking</h3>
            {[...new Set(notice.reasons)].map((reason, i) => (
              <p key={i}>“{reason}”</p>
            ))}
          </section>
        )}
        <button className="button primary full" onClick={onDismiss}>
          Close details <ArrowRight size={17} />
        </button>
        <p className="event-wait-note">
          Notifications do not pause NPC play. Required game decisions and
          worksheets still wait for your input.
        </p>
      </div>
    </Modal>
  );
}
