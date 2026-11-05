import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  CloudLightning,
  Heart,
  Search,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import {
  fastTrackBoard,
  EARLY_OPPORTUNITY_ROUNDS,
  EARLY_OPPORTUNITY_WEIGHT,
} from "../game/content";
import { dreamPrice, money, preciseMoney } from "../game/engine";
import { FIRST_ECONOMIC_ROUND, ECONOMIC_INTERVAL } from "../game/economy";
import {
  isAdaptedEntry,
  wikiCategories,
  wikiEntries,
  wikiEntryId,
  wikiSearchText,
  type WikiCategory,
  type WikiEntry,
} from "../game/wiki";
import type { GameState, Profession } from "../game/types";
import CardSource from "./CardSource";

const icons = {
  roles: Users,
  opportunities: BriefcaseBusiness,
  market: TrendingUp,
  expenses: ShoppingBag,
  cycles: CloudLightning,
  dreams: Star,
  special: Heart,
};
const PAGE_SIZE = 24;
const amount = (value: number) =>
  value % 100 ? preciseMoney(value) : money(value);
const monthly = (value: number) => `${amount(value)} / mo`;
function roleTotals(role: Profession) {
  const payment = role.debts.reduce((sum, debt) => sum + debt.payment, 0);
  const expenses = role.taxes + role.living + payment;
  return {
    expenses,
    flow: role.salary - expenses,
    debt: role.debts.reduce((sum, debt) => sum + debt.principal, 0),
    payment,
  };
}
function categoryName(entry: WikiEntry) {
  return wikiCategories.find((c) => c.id === entry.kind)!.name;
}
function entryTags(entry: WikiEntry) {
  if (entry.kind === "roles")
    return [`${entry.item.difficulty} start`, ...entry.item.traits.slice(0, 1)];
  if (entry.kind === "opportunities")
    return [
      entry.item.tier === "fast" ? "Fast Track" : `${entry.item.tier} deal`,
      entry.item.category,
    ];
  if (entry.kind === "market")
    return [
      entry.item.category,
      entry.item.effect === "dividend"
        ? "cash distribution"
        : entry.item.effect,
    ];
  if (entry.kind === "cycles")
    return [entry.item.tone, `${entry.item.duration} rounds`];
  if (entry.kind === "dreams") return ["Fast Track", "full-game goal"];
  if (entry.kind === "expenses") return ["one-time bill"];
  return ["board & recovery rules"];
}
function entryStatus(entry: WikiEntry, game: GameState) {
  if (isAdaptedEntry(entry))
    return game.config.adaptedCards
      ? "Adapted · enabled"
      : "Adapted · off in this match";
  if (entry.kind === "roles" && entry.item.id === game.players[0].profession)
    return "Your role";
  if (entry.kind === "dreams" && entry.item.id === game.players[0].dream)
    return "Your dream";
  if (entry.kind === "cycles") {
    const active = game.economy.active.find((c) => c.card === entry.item.id);
    return active
      ? `Active through round ${active.expires - 1}`
      : !game.config.economicCycles
        ? "Cycles off in this match"
        : "";
  }
  return "";
}
function summaryStats(entry: WikiEntry, game: GameState): [string, string][] {
  switch (entry.kind) {
    case "roles": {
      const totals = roleTotals(entry.item);
      return [
        ["Salary", monthly(entry.item.salary)],
        ["Cash flow", monthly(totals.flow)],
        ["Total debt", amount(totals.debt)],
      ];
    }
    case "opportunities":
      return [
        [
          entry.item.category === "stock" ? "Price / share" : "Cash needed",
          amount(entry.item.down),
        ],
        [
          entry.item.category === "stock" ? "Income / share" : "Net income",
          monthly(entry.item.income),
        ],
        ["Financing debt", amount(entry.item.mortgage)],
      ];
    case "market":
      return entry.item.effect === "split"
        ? [
            ["Share count", "×2"],
            ["Total value", "Unchanged"],
          ]
        : entry.item.effect === "dividend"
          ? [
              ["Cash / share", amount(entry.item.amount)],
              ["Payment", "One time"],
            ]
          : [
              [
                "Offer basis",
                entry.item.sharePrice !== undefined
                  ? `${amount(entry.item.sharePrice)} / share`
                  : `${Math.round(entry.item.multiplier * 100)}% of value`,
              ],
              ["Sale", "Optional"],
            ];
    case "expenses":
      return [
        ["Cash cost", amount(entry.item.cost)],
        ["Payment", "One time"],
      ];
    case "cycles":
      return [
        ["Duration", `${entry.item.duration} rounds`],
        ["Scope", "All players"],
      ];
    case "dreams":
      return [
        ["Base price", amount(entry.item.cost)],
        [
          "Outer space",
          (() => {
            const position = fastTrackBoard(game.players).findIndex(
              (s) => s.content === entry.item.id,
            );
            return position >= 0
              ? String(position + 1)
              : "Not chosen in this match";
          })(),
        ],
      ];
    case "special":
      return [];
  }
}
function Stats({ values }: { values: [string, string][] }) {
  return (
    <dl className="wiki-stats">
      {values.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function Details({ entry, game }: { entry: WikiEntry; game: GameState }) {
  switch (entry.kind) {
    case "roles": {
      const role = entry.item,
        totals = roleTotals(role);
      return (
        <>
          <Stats
            values={[
              ["Monthly salary", amount(role.salary)],
              ["Monthly taxes", amount(role.taxes)],
              ["Household living costs", monthly(role.living)],
              ["Loan payments", monthly(totals.payment)],
              ["Total expenses", monthly(totals.expenses)],
              ["Monthly cash flow", amount(totals.flow)],
              ["Profession savings", amount(role.savings)],
              ["Cost per child", monthly(role.childCost)],
            ]}
          />
          <p className="wiki-note">
            Baseline role sheet: no children, no investments, 1× living
            expenses. Opening cash uses savings plus one monthly cash flow,
            adjusted by the starting-cash setting, plus the opening reserve if
            liquidity risk is enabled.
          </p>
          <h4>Characteristics</h4>
          <ul>
            {role.traits.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          <h4>Debt breakdown</h4>
          <div className="wiki-debts">
            {role.debts.map((d) => (
              <div key={d.id}>
                <strong>{d.name}</strong>
                <span>{amount(d.principal)} balance</span>
                <span>{monthly(d.payment)}</span>
              </div>
            ))}
          </div>
          <p>{role.debtStory}</p>
          <p className="wiki-note">
            Career debt may support earning power. Personal housing and consumer
            purchases do not create passive income in this game.
          </p>
          <div className="wiki-advice">
            <section>
              <h4>Try for</h4>
              <p>{role.pursue}</p>
            </section>
            <section>
              <h4>Watch out for</h4>
              <p>{role.avoid}</p>
            </section>
          </div>
          <p>
            Choose a starting difficulty in New game to receive a random role
            from its five-role pool. NPC decision difficulty is a separate
            setting.
          </p>
        </>
      );
    }
    case "opportunities": {
      const card = entry.item,
        stock = card.category === "stock";
      return (
        <>
          <Stats
            values={[
              [stock ? "Price / share" : "Purchase price", amount(card.cost)],
              [stock ? "Cash / share" : "Down payment", amount(card.down)],
              ["New financing debt", amount(card.mortgage)],
              ["Financing payment", monthly(card.financing)],
              [
                stock ? "Net income / share" : "Net passive income",
                monthly(card.income),
              ],
              [
                "Annual cash return",
                `${(((card.income * 12) / card.down) * 100).toFixed(1)}%`,
              ],
            ]}
          />
          <h4>Where it appears</h4>
          <p>
            {card.tier === "fast"
              ? "A fixed Fast Track board opportunity. A purchase claims it exclusively."
              : `The ${card.tier} opportunity deck, chosen when you land on an Opportunity space on either track.`}
          </p>
          <h4>How the cash flow works</h4>
          {card.tier === "small" && (
            <p className="wiki-note">
              Rounds 1–{EARLY_OPPORTUNITY_ROUNDS}: each stock and debt-free
              small-business card has {EARLY_OPPORTUNITY_WEIGHT} copies; other
              cards have one. A debt-free business has no included loan or
              financing payment. Draws use a shuffled deck, so odds change as
              cards are drawn and a card may recur before every property
              appears. Round {EARLY_OPPORTUNITY_ROUNDS + 1} starts a fresh
              regular deck with one copy of each eligible card. The same mix
              applies to all players and respects the adapted-card setting.
            </p>
          )}
          <p>
            {stock
              ? "Amounts are per share; multiply cash needed and recurring income by the share count. A zero recurring income means the stock does not help monthly passive-income progress unless another effect changes its income."
              : "The net passive income above already includes financing costs. Those costs are not charged again in household expenses. Partial financing repayment lowers the payment proportionally and raises net passive income."}
          </p>
          <h4>Choices and restrictions</h4>
          <p>
            Buy if you can fund the cash needed, or pass.{" "}
            {card.transferable
              ? "This opportunity can also be offered to an eligible NPC for a negotiated fee; the NPC must accept and buy immediately."
              : "This opportunity cannot be transferred to another player."}{" "}
            Owned assets can be sold only during a matching market offer or
            through distress recovery.
          </p>
          <div className="wiki-advice">
            <section>
              <h4>Before buying</h4>
              <p>
                Check monthly income, financing, and the cash reserve required
                by any new debt. Borrowed down payments add bank interest on top
                of this card’s financing.
              </p>
            </section>
            <section>
              <h4>What can change</h4>
              <p>
                Economic cycles can affect entry prices, asset values, operating
                income and financing. The figures here are the baseline, before
                those effects.
              </p>
            </section>
          </div>
          <CardSource source={card.source} />
        </>
      );
    }
    case "market": {
      const card = entry.item;
      return (
        <>
          <Stats values={summaryStats(entry, game)} />
          <h4>Eligible holdings</h4>
          <p>
            Every player who owns{" "}
            {card.category === "property"
              ? "property"
              : card.category === "business"
                ? "business investments"
                : "stocks or funds"}{" "}
            may respond, on either track.
          </p>
          <h4>What happens</h4>
          <p>
            {card.effect === "offer"
              ? card.sharePrice !== undefined
                ? `The baseline buyer quote is ${amount(card.sharePrice)} per share, multiplied by shares held. Active stock-price conditions apply once.`
                : `The buyer offers ${Math.round(card.multiplier * 100)}% of the holding’s reference value, adjusted for active market-price conditions. Remaining investment financing is deducted from sale proceeds.`
              : card.effect === "split"
                ? "Each eligible stock holding doubles its share count and halves its unit price. Total investment value and monthly income stay unchanged; the split itself adds no cash."
                : `Each eligible shareholder receives ${amount(card.amount)} per share as a one-time cash distribution. This does not change recurring monthly income.`}
          </p>
          <h4>Your choice</h4>
          <p>
            {card.effect === "offer"
              ? "Sell an eligible holding at the quoted proceeds, or keep it. The same event is offered to all eligible owners; a market card does not allow unrelated assets to be sold."
              : "Resolve the event in the decision panel. The split or distribution applies to eligible holdings without a purchase or sale."}
          </p>
          <CardSource source={card.source} />
        </>
      );
    }
    case "expenses":
      return (
        <>
          <Stats values={summaryStats(entry, game)} />
          <h4>When it happens</h4>
          <p>
            Draw from the life-expense deck when landing on Life happens on
            either track.
          </p>
          <h4>Effect on your statement</h4>
          <p>
            Pay {amount(entry.item.cost)} from cash. This is a one-time bill, so
            it does not permanently increase recurring monthly expenses. If cash
            is insufficient, resolve the bill through available borrowing or
            bankruptcy recovery.
          </p>
          <h4>Plan for it</h4>
          <p>
            Keep some liquidity outside your down payments. In guided manual
            mode, the auditor asks for the changed statement totals before the
            transaction commits.
          </p>
          <CardSource source={entry.item.source} />
        </>
      );
    case "cycles": {
      const card = entry.item;
      const changes: [string, string][] = [];
      const change = (n: number) =>
        `${n >= 1 ? "+" : ""}${Math.round((n - 1) * 100)}%`;
      for (const [category, value] of Object.entries(card.values ?? {}))
        changes.push([`${category} values & prices`, change(value)]);
      for (const [category, value] of Object.entries(card.income ?? {}))
        changes.push([`${category} operating income`, change(value)]);
      if (card.loanPayments !== undefined)
        changes.push(["Recurring loan payments", change(card.loanPayments)]);
      return (
        <>
          <Stats values={changes} />
          <h4>Timing</h4>
          <p>
            With economic cycles enabled, the first sudden event starts in round{" "}
            {FIRST_ECONOMIC_ROUND}, then every {ECONOMIC_INTERVAL} rounds: 11,
            14, 17… This event lasts {card.duration} rounds. Conditions
            normalize before the next draw.
          </p>
          <h4>Related assets</h4>
          <p>{card.affected}</p>
          <h4>Real-life parallel</h4>
          <p>{card.scenario}</p>
          <a
            className="wiki-source-link"
            href={card.source.url}
            target="_blank"
            rel="noreferrer"
          >
            {card.source.label} ↗
          </a>
          <p className="wiki-note">
            The percentages are simplified game assumptions. Shared effects
            apply to all players and both tracks; outstanding loan principal
            does not change just because rates or prices move.
          </p>
        </>
      );
    }
    case "dreams": {
      const card = entry.item;
      return (
        <>
          <Stats
            values={[
              ...summaryStats(entry, game),
              ["Price in this match", amount(dreamPrice(game, card.id))],
            ]}
          />
          <h4>How to achieve it</h4>
          <p>
            Choose this dream at setup, reach the Fast Track, and land on its
            marked space. In the full game, purchasing your selected dream wins
            immediately. You may pass if you cannot or do not want to buy.
          </p>
          <p>
            The board shows the dreams chosen by this table. New matches give
            each player a distinct dream, with unused dream spaces becoming
            opportunities. The layout stays fixed after an elimination. Shared
            dreams in older saves remain available on one shared space.
          </p>
          <h4>Why its price can rise</h4>
          <p>
            The current price includes the sandbox dream-price multiplier and
            visits by other players to a chosen dream. Each qualifying visit
            adds one base price before that multiplier.
          </p>
          <p className="wiki-note">
            Financial-freedom mode ends when a player qualifies for the Fast
            Track; dream purchases belong to the full two-stage game.
          </p>
        </>
      );
    }
    case "special":
      return (
        <>
          <h4>Trigger</h4>
          <p>{entry.item.trigger}</p>
          <h4>What happens</h4>
          <p>{entry.item.effect}</p>
          <div className="wiki-advice">
            <section>
              <h4>Plan for it</h4>
              <p>{entry.item.strategy}</p>
            </section>
          </div>
        </>
      );
  }
}

export default function Wiki({ game }: { game: GameState }) {
  const [category, setCategory] = useState<WikiCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<WikiEntry | null>(null);
  const browser = useRef<HTMLDivElement>(null);
  const entryHeading = useRef<HTMLHeadingElement>(null);
  const filtered = useMemo(() => {
    const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return wikiEntries.filter(
      (entry) =>
        (category === "all" || entry.kind === category) &&
        (source === "all" ||
          isAdaptedEntry(entry) === (source === "adapted")) &&
        words.every((word) => wikiSearchText(entry).includes(word)),
    );
  }, [category, query, source]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const start = page * PAGE_SIZE;
  useEffect(() => {
    browser.current?.scrollTo(0, 0);
    if (selected) entryHeading.current?.focus();
  }, [selected, category, query, source, page]);
  function changeCategory(value: WikiCategory | "all") {
    setCategory(value);
    setPage(0);
    setSelected(null);
  }
  function back() {
    const id = selected && wikiEntryId(selected);
    setSelected(null);
    requestAnimationFrame(() =>
      browser.current
        ?.querySelector<HTMLButtonElement>(`[data-wiki-entry="${id}"]`)
        ?.focus(),
    );
  }
  return (
    <div className="wiki">
      <div className="wiki-intro">
        <span className="wiki-book">
          <BookOpen size={25} />
        </span>
        <div>
          <h3>Know your next move.</h3>
          <p>
            Explore every role, card and event. Amounts are baseline USD before
            sandbox settings or active economic cycles.
          </p>
        </div>
      </div>
      <div className="wiki-tools">
        <label className="wiki-search">
          <Search size={17} />
          <span className="wiki-sr-only">Search the wiki</span>
          <input
            type="search"
            placeholder="Search cards, roles, assets, effects…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
              setSelected(null);
            }}
          />
          {query && (
            <button
              className="icon-button"
              aria-label="Clear wiki search"
              onClick={() => {
                setQuery("");
                setPage(0);
                setSelected(null);
              }}
            >
              <X size={16} />
            </button>
          )}
        </label>
        <label className="wiki-source-filter">
          Card set
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(0);
              setSelected(null);
            }}
          >
            <option value="all">All entries</option>
            <option value="original">Original entries</option>
            <option value="adapted">Adapted cards</option>
          </select>
        </label>
      </div>
      <div className="wiki-layout">
        <nav className="wiki-sidebar" aria-label="Wiki categories">
          <button
            aria-pressed={category === "all"}
            onClick={() => changeCategory("all")}
          >
            <BookOpen size={16} />
            <span>All entries</span>
            <small>{wikiEntries.length}</small>
          </button>
          {wikiCategories.map((c) => {
            const Icon = icons[c.id];
            return (
              <button
                key={c.id}
                aria-pressed={category === c.id}
                onClick={() => changeCategory(c.id)}
              >
                <Icon size={16} />
                <span>{c.name}</span>
                <small>
                  {wikiEntries.filter((entry) => entry.kind === c.id).length}
                </small>
              </button>
            );
          })}
          <p>
            Adapted cards are {game.config.adaptedCards ? "enabled" : "off"} in
            this match. All remain available to read here.
          </p>
        </nav>
        <div className="wiki-browser" ref={browser}>
          {selected ? (
            <article className={`wiki-entry wiki-kind-${selected.kind}`}>
              <button className="text-button wiki-back" onClick={back}>
                <ArrowLeft size={15} /> Back to results
              </button>
              <div className="wiki-entry-category">
                {categoryName(selected)}
                {entryStatus(selected, game) && (
                  <span>{entryStatus(selected, game)}</span>
                )}
              </div>
              <h3 tabIndex={-1} ref={entryHeading}>
                {selected.item.name}
              </h3>
              <div className="wiki-tags">
                {entryTags(selected).map((t) => (
                  <span key={t}>{t}</span>
                ))}
              </div>
              <p className="wiki-entry-description">
                {selected.item.description}
              </p>
              <Details entry={selected} game={game} />
            </article>
          ) : (
            <>
              <div className="wiki-results-heading">
                <div>
                  <h3>
                    {category === "all"
                      ? "The complete collection"
                      : wikiCategories.find((c) => c.id === category)!.name}
                  </h3>
                  <p>
                    {category === "all"
                      ? "Find a familiar card, or discover what is possible."
                      : wikiCategories.find((c) => c.id === category)!
                          .description}
                  </p>
                </div>
                <span role="status">
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "entry" : "entries"}
                </span>
              </div>
              {filtered.length ? (
                <>
                  <div className="wiki-grid">
                    {filtered.slice(start, start + PAGE_SIZE).map((entry) => {
                      const Icon = icons[entry.kind];
                      const status = entryStatus(entry, game);
                      return (
                        <article
                          key={wikiEntryId(entry)}
                          className={`wiki-card wiki-kind-${entry.kind}`}
                        >
                          <div className="wiki-card-top">
                            <span>
                              <Icon size={14} />
                              {categoryName(entry)}
                            </span>
                            {status && <small>{status}</small>}
                          </div>
                          <h4>{entry.item.name}</h4>
                          <div className="wiki-tags">
                            {entryTags(entry).map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <p>{entry.item.description}</p>
                          <Stats values={summaryStats(entry, game)} />
                          <button
                            className="wiki-read"
                            data-wiki-entry={wikiEntryId(entry)}
                            aria-label={`Read entry: ${entry.item.name}${entry.kind === "market" ? ` (${entry.item.category})` : ""}`}
                            onClick={() => setSelected(entry)}
                          >
                            Read entry <ArrowRight size={14} />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  {pageCount > 1 && (
                    <nav
                      className="wiki-pagination"
                      aria-label="Wiki result pages"
                    >
                      <button
                        className="button secondary small-button"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft size={15} /> Previous
                      </button>
                      <span>
                        Page {page + 1} of {pageCount}
                      </span>
                      <button
                        className="button secondary small-button"
                        disabled={page + 1 >= pageCount}
                        onClick={() => setPage(page + 1)}
                      >
                        Next <ChevronRight size={15} />
                      </button>
                    </nav>
                  )}
                </>
              ) : (
                <div className="wiki-empty">
                  <Search size={30} />
                  <h4>No matching entries</h4>
                  <p>
                    Try another name or effect, or clear your filters to explore
                    the collection.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      changeCategory("all");
                      setQuery("");
                      setSource("all");
                    }}
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
