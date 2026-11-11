import { useEffect, useRef, useState } from "react";
import { Bell, ChevronUp, X } from "lucide-react";
import type { ActivityNotice } from "../game/types";
import { noticeRelatesToPlayer } from "../game/activity";
export default function Notifications({
  notices,
  onDismiss,
  onExpand,
  onClear,
  onlyMine,
  playerId,
}: {
  notices: ActivityNotice[];
  onDismiss: (id: number) => void;
  onExpand: (notice: ActivityNotice) => void;
  onClear: () => void;
  onlyMine: boolean;
  playerId: string;
}) {
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const [visibleCount, setVisibleCount] = useState(() =>
    window.matchMedia("(max-width: 800px)").matches ? 1 : 2,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 800px)");
    const update = () => setVisibleCount(media.matches ? 1 : 2);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    for (const notice of notices)
      if (!timers.current.has(notice.id))
        timers.current.set(
          notice.id,
          setTimeout(() => onDismiss(notice.id), 30000),
        );
    for (const [id, timer] of timers.current)
      if (!notices.some((n) => n.id === id)) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
  }, [notices, onDismiss]);
  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );
  const shown = onlyMine
    ? notices.filter((n) => noticeRelatesToPlayer(n, playerId))
    : notices;
  if (!notices.length) return null;
  return (
    <aside
      className={`notification-stack ${shown.length > visibleCount ? "has-pile" : ""}`}
      aria-label="Game notifications"
    >
      <div className="notification-live" aria-live="polite" aria-atomic="true">
        {shown.at(-1)?.title}
      </div>
      <div className="notification-history">
        {shown.length > visibleCount ? (
          <details className="older-notifications">
            <summary>
              <Bell size={14} /> {shown.length - visibleCount} earlier updates{" "}
              <span>Expand stack</span>
            </summary>
            <div className="notification-history-list">
              {shown
                .slice(0, -visibleCount)
                .reverse()
                .map((n) => (
                  <button
                    key={n.id}
                    aria-label={`View details: ${n.title}`}
                    onClick={() => onExpand(n)}
                  >
                    {n.title}
                  </button>
                ))}
            </div>
          </details>
        ) : (
          <div className="notification-stack-label">
            <Bell size={14} />{" "}
            {shown.length ? "Notifications" : "No updates involving you"}
          </div>
        )}
        <button
          className="notification-clear"
          aria-label="Clear all notifications"
          title="Clear all notifications, including filtered updates"
          onClick={onClear}
        >
          Clear all
        </button>
      </div>
      {shown.slice(-visibleCount).map((n) => (
        <div
          key={n.id}
          className={`game-notification ${n.kind} ${n.tone ?? "neutral"}`}
        >
          <button
            className="notification-expand"
            aria-label={`View details: ${n.title}`}
            onClick={() => onExpand(n)}
          >
            <span className="notification-meta">
              <Bell size={13} />{" "}
              {n.kind === "cycle"
                ? "ECONOMIC CYCLE"
                : n.kind === "risk"
                  ? "LIQUIDITY RISK"
                  : `ROUND ${n.round}`}
              <ChevronUp size={14} />
            </span>
            <strong>{n.title}</strong>
            <span className="notification-preview">
              {n.kind === "npc-turn"
                ? n.events.slice(-1)[0]?.replace(/^.*?: /, "")
                : n.description}
            </span>
          </button>
          <button
            className="notification-dismiss icon-button"
            aria-label={`Dismiss: ${n.title}`}
            onClick={() => onDismiss(n.id)}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </aside>
  );
}
