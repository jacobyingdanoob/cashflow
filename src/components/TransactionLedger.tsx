import { useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { preciseMoney } from "../game/engine";
import { transactionHistory } from "../game/transactions";
import type { GameState, Player } from "../game/types";

const PAGE_SIZE = 10;
export default function TransactionLedger({
  game,
  player,
}: {
  game: GameState;
  player: Player;
}) {
  const [page, setPage] = useState(1),
    [oldestFirst, setOldestFirst] = useState(false);
  const transactions = useMemo(() => {
    const entries = transactionHistory(game, player.id);
    return oldestFirst ? entries.reverse() : entries;
  }, [game.history, game.receipts, player.id, oldestFirst]);
  const pages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const current = Math.min(page, pages),
    start = (current - 1) * PAGE_SIZE;
  const pageNumbers = [
    ...new Set([
      1,
      ...Array.from({ length: 3 }, (_, i) => current - 1 + i),
      pages,
    ]),
  ]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b);
  if (!transactions.length)
    return (
      <div className="empty-state">
        <BookOpen size={32} />
        <h3>
          {player.human
            ? "Your story starts here."
            : "No financial transactions yet."}
        </h3>
        <p>Every financial transaction gets a receipt.</p>
      </div>
    );
  return (
    <section
      aria-label={`${player.human ? "Your" : `${player.name}’s`} transaction history`}
    >
      <div className="ledger-toolbar">
        <p role="status">
          {start + 1}–{Math.min(start + PAGE_SIZE, transactions.length)} of{" "}
          {transactions.length} transactions
        </p>
        <label>
          Order{" "}
          <select
            aria-label="Transaction order"
            value={oldestFirst ? "oldest" : "newest"}
            onChange={(event) => {
              setOldestFirst(event.target.value === "oldest");
              setPage(1);
            }}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      <p className="small muted">
        Full history from round {game.historyStartRound}. 10 transactions per
        page.
      </p>
      {game.historyStartRound > 1 && (
        <p className="finance-view-note">
          This older save started full history tracking in round{" "}
          {game.historyStartRound}. Earlier retained receipts appear where
          available; missing records cannot be recovered.
        </p>
      )}
      <nav className="ledger-pagination" aria-label="Transaction pages">
        <button
          className="button secondary small-button"
          aria-label="Previous transaction page"
          disabled={current === 1}
          onClick={() => setPage(current - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        {pageNumbers.map((number, i) => (
          <span className="ledger-page-number" key={number}>
            {i > 0 && number - pageNumbers[i - 1] > 1 && (
              <span aria-hidden="true">…</span>
            )}
            <button
              className={`button small-button ${number === current ? "primary" : "secondary"}`}
              aria-label={`Transaction page ${number}`}
              aria-current={number === current ? "page" : undefined}
              onClick={() => setPage(number)}
            >
              {number}
            </button>
          </span>
        ))}
        <button
          className="button secondary small-button"
          aria-label="Next transaction page"
          disabled={current === pages}
          onClick={() => setPage(current + 1)}
        >
          <ChevronRight size={15} />
        </button>
        <span className="ledger-page-count">
          Page {current} of {pages}
        </span>
      </nav>
      {transactions.slice(start, start + PAGE_SIZE).map((receipt) => (
        <details className="ledger-item ledger-calculations" key={receipt.id}>
          <summary>
            <span>
              <small className="ledger-round">
                {receipt.round === null
                  ? "Earlier receipt · round unavailable"
                  : `Round ${receipt.round}`}
              </small>
              {receipt.title}
            </span>
            <strong
              className={
                receipt.after.cash - receipt.before.cash < 0
                  ? "negative"
                  : "positive"
              }
            >
              {receipt.after.cash - receipt.before.cash >= 0 ? "+" : ""}
              {preciseMoney(receipt.after.cash - receipt.before.cash)}
            </strong>
          </summary>
          <div>
            <small>{receipt.note}</small>
            <dl className="ledger-totals">
              {(
                [
                  ["cash", "Cash"],
                  ["assets", "Asset value"],
                  ["debt", "Total debt"],
                  ["passive", "Monthly passive income"],
                  ["expenses", "Monthly expenses"],
                  ["flow", "Monthly cash flow"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>
                    {preciseMoney(receipt.before[key])} →{" "}
                    {preciseMoney(receipt.after[key])}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </details>
      ))}
    </section>
  );
}
