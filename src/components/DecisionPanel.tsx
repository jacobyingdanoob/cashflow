import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  Dice5,
  Flag,
  Heart,
  Landmark,
  Lightbulb,
  ShoppingBag,
  Sparkles,
  Star,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import {
  deals,
  dreams,
  markets,
  EARLY_OPPORTUNITY_ROUNDS,
  EARLY_OPPORTUNITY_WEIGHT,
} from "../game/content";
import {
  actingPlayer,
  assetFromDeal,
  dreamPrice,
  eligibleAssets,
  money,
  preciseMoney,
  playerFinancials,
  marketSalePrice,
} from "../game/engine";
import CardSource from "./CardSource";
import AssetCashFlow from "./AssetCashFlow";
import {
  assetIncome,
  distressValue,
  effectiveDeal,
  factor,
  installment,
  requiredReserve,
} from "../game/economy";
import type { GameAction, GameState } from "../game/types";
const fieldLabels: Record<string, string> = {
  cash: "Cash on hand",
  assets: "Investment assets (current value)",
  debt: "Total liabilities",
  income: "Total monthly income",
  expenses: "Total monthly expenses",
  passive: "Monthly passive income",
  flow: "Monthly cash flow",
};
export function Worksheet({
  game,
  dispatch,
}: {
  game: GameState;
  dispatch: (a: GameAction) => void;
}) {
  const pending = game.pending!,
    [hints, setHints] = useState(false);
  const values = pending.values;
  return (
    <div className="worksheet">
      <div className="decision-illustration sage">
        <BookOpen size={34} />
        <span className="mini-spark">✦</span>
      </div>
      <span className="eyebrow">YOUR BOOKS, YOUR BUSINESS</span>
      <h3>Let’s balance the books.</h3>
      <p className="muted">
        {pending.receipt.title}. Enter the new totals in dollars, then ask your
        auditor to check.
      </p>
      <div className="worksheet-fields">
        {pending.fields.map((k) => (
          <label
            key={k}
            className={`worksheet-field ${pending.errors.includes(k) ? "invalid" : ""}`}
          >
            <span>
              {fieldLabels[k]}
              <small>Before: {preciseMoney(pending.receipt.before[k])}</small>
            </span>
            <div className="money-input">
              <span>$</span>
              <input
                inputMode="decimal"
                autoComplete="off"
                aria-label={fieldLabels[k]}
                value={values[k] ?? ""}
                aria-invalid={pending.errors.includes(k)}
                onChange={(e) =>
                  dispatch({ type: "DRAFT", field: k, value: e.target.value })
                }
              />
            </div>
            {pending.errors.includes(k) && (
              <small className="field-error">
                Check this total and try again.
              </small>
            )}
            {hints && (
              <small className="field-hint">
                Change:{" "}
                {preciseMoney(
                  pending.receipt.after[k] - pending.receipt.before[k],
                )}
              </small>
            )}
          </label>
        ))}
      </div>
      <button
        className="button primary full"
        onClick={() => dispatch({ type: "SUBMIT", values })}
      >
        Check my worksheet <Check size={17} />
      </button>
      <div className="worksheet-tools">
        <button className="text-button" onClick={() => setHints(!hints)}>
          {hints ? "Hide hints" : "Show a hint"}
        </button>
        <button
          className="text-button"
          onClick={() =>
            pending.fields.forEach((k) =>
              dispatch({
                type: "DRAFT",
                field: k,
                value: (pending.receipt.after[k] / 100).toFixed(2),
              }),
            )
          }
        >
          Reveal values
        </button>
      </div>
      <p className="small muted">
        No penalties for learning. The transaction posts once your totals
        reconcile.
      </p>
    </div>
  );
}
export default function DecisionPanel({
  game,
  dispatch,
  onFinances,
}: {
  game: GameState;
  dispatch: (a: GameAction) => void;
  onFinances: () => void;
}) {
  const p = actingPlayer(game),
    f = playerFinancials(game, p),
    d = game.decision;
  const [shares, setShares] = useState(10),
    [fee, setFee] = useState(100),
    [target, setTarget] = useState(1),
    [transfer, setTransfer] = useState(false),
    [dice, setDice] = useState(2);
  if (game.pending)
    return (
      <Worksheet
        key={game.pending.receipt.id}
        game={game}
        dispatch={dispatch}
      />
    );
  if (game.phase === "finished")
    return (
      <div className="decision-content">
        <div className="decision-illustration gold">
          <Star size={38} />
        </div>
        <span className="eyebrow">A CHAPTER COMPLETE</span>
        <h3>
          {game.winners.includes("p0")
            ? "Look how far you’ve come."
            : "Every move taught you something."}
        </h3>
        <p className="muted">{game.finishReason}</p>
        <div className="callout">
          {game.winners.length
            ? game.winners
                .map((id) => game.players.find((p) => p.id === id)?.name)
                .join(" & ")
            : "No one"}{" "}
          {game.winners.length === 1 ? "wins" : "share the result"}.
        </div>
        <button className="button primary full" onClick={onFinances}>
          Explore the results <ArrowRight size={17} />
        </button>
      </div>
    );
  if (game.players[0].eliminated)
    return (
      <div className="decision-content">
        <div className="decision-illustration sage">
          <Flag size={36} />
        </div>
        <span className="eyebrow">SPECTATING</span>
        <h3>Your game is over.</h3>
        <p className="muted">
          The remaining players are continuing. Your personal review is ready,
          and the final report will open when the match ends.
        </p>
        <button className="button primary full" onClick={onFinances}>
          Review my game <ArrowRight size={17} />
        </button>
      </div>
    );
  if (!p.human)
    return (
      <div className="decision-content npc-thinking">
        <div className="decision-illustration sage">
          <BriefcaseBusiness size={36} />
        </div>
        <span className="eyebrow">A DIFFERENT PERSPECTIVE</span>
        <h3>{p.name} is making a move.</h3>
        <p className="muted">
          Watch how different investors weigh the same opportunities.
        </p>
        <div className="thinking-dots">
          <span />
          <span />
          <span />
        </div>
        <blockquote>
          {game.log.find((e) => e.player === p.name && e.text.startsWith("“"))
            ?.text ?? "“A little patience can go a long way.”"}
        </blockquote>
        <p className="small muted">
          NPCs use the same dice and financial rules as you.
        </p>
      </div>
    );
  if (game.phase === "roll")
    return (
      <div className="decision-content">
        <div className="decision-illustration dice-scene">
          <Dice5 size={61} strokeWidth={1.2} />
          <span className="dice-star one">✦</span>
          <span className="dice-star two">✧</span>
        </div>
        <span className="eyebrow">A LITTLE MOMENTUM</span>
        <h3>{p.skip ? "Take a little time." : "Your next chapter awaits."}</h3>
        <p className="muted">
          {p.skip
            ? `${p.skip} recovery turn${p.skip === 1 ? "" : "s"} remaining. Your portfolio will be here when you’re ready.`
            : p.stage === "fast"
              ? "Bigger opportunities. The same thoughtful strategy. Make your next move."
              : "A new opportunity, a little surprise, or a step closer to financial freedom. Let’s see what’s next."}
        </p>
        {p.charity > 0 && (
          <label className="form-field compact">
            Charity dice
            <select
              aria-label="Number of dice"
              value={Math.min(dice, p.stage === "fast" ? 3 : 2)}
              onChange={(e) => setDice(Number(e.target.value))}
            >
              {(p.stage === "fast" ? [1, 2, 3] : [1, 2]).map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? "die" : "dice"}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className="button primary full roll-button"
          onClick={() =>
            dispatch({
              type: "ROLL",
              ...(p.charity
                ? { dice: Math.min(dice, p.stage === "fast" ? 3 : 2) }
                : {}),
            })
          }
        >
          <Dice5 size={19} /> {p.skip ? "Take recovery turn" : "Roll the dice"}{" "}
          <ArrowRight size={18} />
        </button>
        <p className="roll-footnote">
          {p.stage === "rat"
            ? "One roll. A world of possibilities."
            : "Your income stays with you on the Fast Track."}
        </p>
      </div>
    );
  if (game.phase === "end")
    return (
      <div className="decision-content">
        <div className="decision-illustration sage">
          <Check size={37} />
        </div>
        <span className="eyebrow">ONE STEP FURTHER</span>
        <h3>A move toward more.</h3>
        <p className="muted">
          Review your finances, pay down a debt, or pass the dice.{" "}
          {game.config.principalRate > 0 &&
            `Principal due at turn end: ${preciseMoney(game.economy.principalPaid[p.id] === game.round ? 0 : installment(p, game.config.principalRate))}.`}
        </p>
        {game.dice.length > 0 && (
          <div className="last-roll">
            You rolled <strong>{game.dice.join(" + ")}</strong>
            <span>·</span>
            {game.dice.reduce((a, b) => a + b, 0)} spaces
          </div>
        )}
        <button
          className="button primary full"
          onClick={() => dispatch({ type: "END" })}
        >
          End my turn <ArrowRight size={18} />
        </button>
        <button className="button secondary full" onClick={onFinances}>
          <Landmark size={17} /> Manage my finances
        </button>
      </div>
    );
  if (d?.kind === "opportunity" && !d.card)
    return (
      <div className="decision-content">
        <div className="decision-illustration sage">
          <BriefcaseBusiness size={36} />
        </div>
        <span className="eyebrow">OPPORTUNITY KNOCKS</span>
        <h3>Think small. Or dream big.</h3>
        <p className="muted">
          Choose a deck to discover your next investment. You can review the
          deal before committing.
        </p>
        <button
          className="deck-choice"
          onClick={() => dispatch({ type: "DRAW", tier: "small" })}
        >
          <div className="deck-icon">
            <ShoppingBag size={23} />
          </div>
          <div>
            <strong>Small opportunities</strong>
            <small>
              {game.round <= EARLY_OPPORTUNITY_ROUNDS
                ? `Early mix · stocks & debt-free businesses favored ${EARLY_OPPORTUNITY_WEIGHT}×`
                : "Shares, side ventures & smaller rentals"}
            </small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button
          className="deck-choice"
          onClick={() => dispatch({ type: "DRAW", tier: "large" })}
        >
          <div className="deck-icon gold">
            <BriefcaseBusiness size={23} />
          </div>
          <div>
            <strong>Big possibilities</strong>
            <small>Larger properties & established businesses</small>
          </div>
          <ChevronRight size={18} />
        </button>
        <button
          className="text-button skip-button"
          onClick={() => dispatch({ type: "PASS" })}
        >
          Pass this opportunity
        </button>
      </div>
    );
  if (d?.kind === "opportunity" && d.card) {
    const card = effectiveDeal(
        game,
        deals.find((c) => c.id === d.card)!,
      ),
      count = card.category === "stock" ? shares : 1,
      previewAsset = assetFromDeal(card, "preview", count),
      previewIncome = assetIncome(game, previewAsset),
      cost = card.down * count,
      short = Math.max(0, cost - p.cash);
    return (
      <div className="decision-content deal-content">
        <span className="card-category">
          <BriefcaseBusiness size={14} />
          {card.category === "property"
            ? "REAL ESTATE"
            : card.category === "stock"
              ? "THE STOCK MARKET"
              : "BUSINESS OPPORTUNITY"}
        </span>
        <h3>{card.name}</h3>
        <p className="muted">{card.description}</p>
        <CardSource source={card.source} />
        <div className="deal-yield">
          <span>Monthly passive income</span>
          <strong className={previewIncome < 0 ? "negative" : ""}>
            {preciseMoney(previewIncome)}
            <small>/mo</small>
          </strong>
          <span>
            <TrendingUp size={14} />
            {Math.round(((previewIncome * 12) / (card.down * count)) * 100)}%
            annual cash-on-cash return
          </span>
        </div>
        {card.category === "stock" && (
          <label className="form-field">
            Number of shares
            <input
              aria-label="Number of shares"
              type="number"
              min="1"
              max="100000"
              value={shares}
              onChange={(e) => setShares(Number(e.target.value))}
            />
          </label>
        )}
        <dl className="deal-details">
          <div>
            <dt>
              {card.category === "stock" ? "Share purchase" : "Down payment"}
            </dt>
            <dd>{money(cost)}</dd>
          </div>
          {card.mortgage > 0 && (
            <>
              <div>
                <dt>Purchase price</dt>
                <dd>{money(card.cost)}</dd>
              </div>
              <div>
                <dt>Included financing</dt>
                <dd>{money(card.mortgage)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Cash after purchase</dt>
            <dd className={p.cash < cost ? "negative" : ""}>
              {money(p.cash - cost)}
            </dd>
          </div>
        </dl>
        <AssetCashFlow game={game} asset={previewAsset} />
        <button
          className="button primary full"
          disabled={p.cash < cost || !Number.isInteger(count) || count < 1}
          onClick={() => dispatch({ type: "BUY", shares: count })}
        >
          Make the investment <ArrowUpRight size={17} />
        </button>
        {short > 0 && (
          <button
            className="button secondary full"
            onClick={() =>
              dispatch({
                type: "BORROW",
                amount: Math.ceil(short / 100000) * 100000,
              })
            }
          >
            Borrow {money(Math.ceil(short / 100000) * 100000)} to cover it
          </button>
        )}
        <button
          className="text-button skip-button"
          onClick={() => dispatch({ type: "PASS" })}
        >
          Keep my cash · pass
        </button>
        {card.transferable && !d.transferred && (
          <>
            <button
              className="text-button"
              onClick={() => setTransfer(!transfer)}
            >
              Offer this opportunity to an NPC
            </button>
            {transfer && (
              <div className="transfer-form">
                <label className="form-field">
                  Offer to
                  <select
                    value={target}
                    onChange={(e) => setTarget(Number(e.target.value))}
                  >
                    {game.players.map(
                      (p, i) =>
                        !p.human &&
                        !p.eliminated && (
                          <option key={p.id} value={i}>
                            {p.name}
                          </option>
                        ),
                    )}
                  </select>
                </label>
                <label className="form-field">
                  Transfer fee ($)
                  <input
                    type="number"
                    min="0"
                    value={fee}
                    onChange={(e) => setFee(Number(e.target.value))}
                  />
                </label>
                <button
                  className="button secondary full"
                  onClick={() =>
                    dispatch({
                      type: "TRANSFER",
                      target,
                      price: Math.round(fee * 100),
                    })
                  }
                >
                  Propose transfer
                </button>
                <p className="small muted">
                  They’ll accept only if the deal fits their reserves and
                  expected return.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
  if (d?.kind === "market") {
    const card = markets.find((c) => c.id === d.card)!,
      assets = eligibleAssets(game, p, d.card);
    return (
      <div className="decision-content">
        <div className="decision-illustration blue">
          <TrendingUp size={37} />
        </div>
        <span className="eyebrow">THE MARKET IS MOVING</span>
        <h3>{card.name}</h3>
        <p className="muted">{card.description}</p>
        <CardSource source={card.source} />
        {card.effect === "offer" && (
          <>
            <div className="callout">
              Buyer’s offer:{" "}
              {card.sharePrice !== undefined
                ? `${preciseMoney(Math.round(card.sharePrice * factor(game, "values", "stock")))} per share`
                : `${Math.round(card.multiplier * 100)}% of current game value`}
              .<small>Mortgages are settled from the proceeds.</small>
            </div>
            {assets.map((a) => (
              <div className="market-asset" key={a.id}>
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    {preciseMoney(marketSalePrice(a, card, game))} net proceeds
                    · −{preciseMoney(assetIncome(game, a))}/mo
                  </small>
                </div>
                <button
                  className="button small-button secondary"
                  disabled={p.cash + marketSalePrice(a, card, game) < 0}
                  onClick={() => dispatch({ type: "SELL", assetId: a.id })}
                >
                  Sell
                </button>
              </div>
            ))}
          </>
        )}
        <button
          className="button primary full"
          onClick={() => dispatch({ type: "PASS" })}
        >
          {card.effect === "offer"
            ? "Finish market response"
            : "Record shareholder event"}{" "}
          <ArrowRight size={17} />
        </button>
      </div>
    );
  }
  if (d?.kind === "charity") {
    const amount = Math.round(f.income / 10);
    return (
      <div className="decision-content">
        <div className="decision-illustration lavender">
          <Heart size={36} />
        </div>
        <span className="eyebrow">A LITTLE GOOD GOES A LONG WAY</span>
        <h3>Give a little. Go further.</h3>
        <p className="muted">
          Donate 10% of your monthly income.{" "}
          {p.stage === "fast"
            ? "Choose one, two, or three dice on every future turn."
            : "Choose one or two dice on each of your next three turns."}
        </p>
        <div className="deal-yield">
          <span>Your contribution</span>
          <strong>{money(amount)}</strong>
          <span>{money(p.cash - amount)} cash remaining</span>
        </div>
        <button
          className="button primary full"
          disabled={p.cash < amount}
          onClick={() => dispatch({ type: "CHARITY", accept: true })}
        >
          Make a contribution <Heart size={17} />
        </button>
        <button
          className="text-button skip-button"
          onClick={() => dispatch({ type: "CHARITY", accept: false })}
        >
          Maybe another time
        </button>
      </div>
    );
  }
  if (d?.kind === "dream") {
    const dream = dreams.find((v) => v.id === d.id)!,
      price = dreamPrice(game, d.id);
    return (
      <div className="decision-content">
        <div className="decision-illustration gold">
          <Star size={40} />
        </div>
        <span className="eyebrow">THIS IS WHAT IT’S ALL FOR</span>
        <h3>{dream.name}</h3>
        <p className="muted">{dream.description}</p>
        <div className="deal-yield">
          <span>Your dream is within reach</span>
          <strong>{money(price)}</strong>
          <span>{money(p.cash)} cash available</span>
        </div>
        <button
          className="button primary full"
          disabled={p.cash < price}
          onClick={() => dispatch({ type: "BUY" })}
        >
          Make your dream real <Sparkles size={18} />
        </button>
        <button
          className="text-button skip-button"
          onClick={() => dispatch({ type: "PASS" })}
        >
          Keep building toward it
        </button>
      </div>
    );
  }
  if (d?.kind === "liquidity")
    return (
      <div
        className={`decision-content liquidity-decision ${game.config.accounting === "auto" ? "warned" : ""}`}
      >
        <div
          className={`decision-illustration ${game.config.accounting === "auto" ? "coral" : "sage"}`}
        >
          {game.config.accounting === "auto" ? (
            <TriangleAlert size={36} />
          ) : (
            <Landmark size={36} />
          )}
        </div>
        <span className="eyebrow">REQUIRED RECOVERY</span>
        <h3>Liquidity crisis</h3>
        <p>
          Cash must cover 10% of total debt. Cash: {preciseMoney(p.cash)}.
          Required: {preciseMoney(requiredReserve(p))}. Sell an investment at
          half its current equity value, or enter bankruptcy recovery.
        </p>
        {p.assets.map((a) => (
          <div className="market-asset" key={a.id}>
            <div>
              <strong>{a.name}</strong>
              <small>
                {preciseMoney(distressValue(game, a))} cash · remaining
                financing removed
              </small>
            </div>
            <button
              className="button secondary small-button"
              onClick={() => dispatch({ type: "LIQUIDATE", assetId: a.id })}
            >
              Forced sale
            </button>
          </div>
        ))}
        <button
          className="button secondary full"
          onClick={() => dispatch({ type: "BANKRUPT" })}
        >
          Bankruptcy recovery
        </button>
        <p className="small muted">
          Recovery that cannot restore the reserve and positive monthly cash
          flow eliminates the player.
        </p>
      </div>
    );
  if (d?.kind === "insolvency") {
    const short = Math.max(0, d.amount - p.cash);
    return (
      <div className="decision-content">
        <div className="decision-illustration coral">
          <TriangleAlert size={37} />
        </div>
        <span className="eyebrow">TIME TO REGROUP</span>
        <h3>A financial bump in the road.</h3>
        <p className="muted">
          {d.title}. A payment of {money(d.amount)} is due. You have{" "}
          {money(p.cash)} in cash.
        </p>
        {short > 0 ? (
          <button
            className="button primary full"
            onClick={() =>
              dispatch({
                type: "BORROW",
                amount: Math.ceil(short / 100000) * 100000,
              })
            }
          >
            <Landmark size={17} /> Borrow{" "}
            {money(Math.ceil(short / 100000) * 100000)}
          </button>
        ) : (
          <button
            className="button primary full"
            onClick={() => dispatch({ type: "PASS" })}
          >
            Pay the balance <Check size={17} />
          </button>
        )}
        <p className="small muted">
          Loans cost {game.config.annualRate}% per year, paid monthly. Check
          that you can afford the extra expense.
        </p>
        {p.assets.map((a) => (
          <div className="market-asset" key={a.id}>
            <div>
              <strong>{a.name}</strong>
              <small>Distress recovery: {money(distressValue(game, a))}</small>
            </div>
            <button
              className="button small-button secondary"
              onClick={() => dispatch({ type: "LIQUIDATE", assetId: a.id })}
            >
              Liquidate
            </button>
          </div>
        ))}
        <button
          className="text-button skip-button danger-text"
          onClick={() => dispatch({ type: "BANKRUPT" })}
        >
          Use bankruptcy recovery
        </button>
        <p className="small muted">
          Recovery sells assets as needed, reviews debt, and costs three turns.
          If your finances cannot recover, you leave the game.
        </p>
      </div>
    );
  }
  return (
    <div className="decision-content">
      <CircleDollarSign />
      <h3>Let’s review your position.</h3>
      <button className="button primary" onClick={onFinances}>
        Open finances
      </button>
    </div>
  );
}
export function FirstTurn({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="first-turn">
      <div className="tip-icon">
        <Lightbulb size={20} />
      </div>
      <div>
        <strong>A good first move? Get curious.</strong>
        <p>
          Roll, explore a deal, and check its monthly income against the cash
          you’ll spend. You can always pass.
        </p>
        <button className="text-button" onClick={onDismiss}>
          Got it, let’s play <ChevronRight size={13} />
        </button>
      </div>
    </div>
  );
}
