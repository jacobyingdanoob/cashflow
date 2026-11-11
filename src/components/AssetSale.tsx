import { Clock3, TrendingUp } from "lucide-react";
import {
  actingPlayer,
  marketSalePrice,
  marketSaleQuote,
  preciseMoney,
} from "../game/engine";
import { marketById } from "../game/content";
import { saleQuote } from "../game/market";
import { voluntarySaleQuote } from "../game/sales";
import type { Asset, GameAction, GameState, Player } from "../game/types";

export default function AssetSale({
  game,
  asset,
  player,
  readOnly,
  dispatch,
}: {
  game: GameState;
  asset: Asset;
  player: Player;
  readOnly: boolean;
  dispatch: (action: GameAction) => void;
}) {
  const listing = asset.listing;
  const offer =
    game.decision?.kind === "market"
      ? marketById(game.decision.card)
      : undefined;
  const market =
    offer?.category === asset.category &&
    offer.effect === "offer" &&
    actingPlayer(game).id === player.id;
  const quickQuote = voluntarySaleQuote(game, asset);
  const quote = market
    ? game.marketState
      ? marketSaleQuote(game, asset)
      : saleQuote(
          game,
          asset,
          marketSalePrice(asset, offer!, game) + asset.mortgage,
        )
    : quickQuote;
  const net = quote.net;
  const canSell =
    !readOnly &&
    !game.pending &&
    game.phase !== "finished" &&
    player.cash + net >= 0;
  if (readOnly && !listing) return null;
  const immediate = market || asset.category === "stock";
  return (
    <div className="asset-sale">
      {listing && (
        <div className="asset-sale-status" role="status">
          <Clock3 size={15} />
          <span>
            <strong>Listed · closes round {listing.closesRound}</strong>
            <small>
              At the start of {player.human ? "your" : `${player.name}’s`} turn.
              Agreed gross price: {preciseMoney(listing.gross)}. Income
              continues until closing.
            </small>
          </span>
        </div>
      )}
      {(!listing || market) && !readOnly && (
        <details className="asset-sale-quote">
          <summary>
            <TrendingUp size={14} />
            {market
              ? "Sell at this market offer"
              : immediate
                ? "Sell stocks now"
                : "List for sale"}
            <strong>{preciseMoney(net)} net</strong>
          </summary>
          <p>
            {market
              ? "Immediate market-space sale: no quick-sale discount or waiting period."
              : immediate
                ? "Sell the entire holding at the current stock price. No quick-sale discount or waiting period."
                : "A seeded 1–3-round closing period is drawn when you list. The gross price is locked now; income and financing continue until closing. Your remaining mortgage, fees and tax are settled then."}
          </p>
          <dl>
            {!market && asset.category !== "stock" && (
              <div>
                <dt>Quick-sale discount</dt>
                <dd>
                  {quickQuote.discountBps / 100}% · −
                  {preciseMoney(quickQuote.discount)}
                </dd>
              </div>
            )}
            <div>
              <dt>Gross sale price</dt>
              <dd>{preciseMoney(quote.gross)}</dd>
            </div>
            <div>
              <dt>Bank selling fee</dt>
              <dd>−{preciseMoney(quote.fee)}</dd>
            </div>
            <div>
              <dt>Early mortgage payoff</dt>
              <dd>−{preciseMoney(quote.penalty)}</dd>
            </div>
            <div>
              <dt>Capital-gains tax</dt>
              <dd>−{preciseMoney(quote.tax)}</dd>
            </div>
            <div>
              <dt>Included mortgage settled</dt>
              <dd>−{preciseMoney(quote.mortgage)}</dd>
            </div>
            <div>
              <dt>Cash received</dt>
              <dd>{preciseMoney(net)}</dd>
            </div>
          </dl>
          <button
            className="button secondary small-button"
            disabled={!canSell}
            onClick={() =>
              dispatch(
                market
                  ? { type: "SELL", assetId: asset.id }
                  : {
                      type: "SELL_ANYTIME",
                      playerId: player.id,
                      assetId: asset.id,
                    },
              )
            }
          >
            {market
              ? "Sell at market price now"
              : immediate
                ? "Sell all shares"
                : "Confirm listing"}
          </button>
          {player.cash + net < 0 && (
            <p className="inline-error">
              You need enough cash to settle the remaining mortgage and sale
              costs.
            </p>
          )}
          {!market && asset.category !== "stock" && (
            <small>
              Closing cash is an estimate: partial mortgage repayments and
              expiry of an early-payoff penalty can improve it. A listing does
              not provide emergency cash today.
            </small>
          )}
        </details>
      )}
      {listing && !readOnly && (
        <button
          className="text-button"
          disabled={!!game.pending || game.phase === "finished"}
          onClick={() =>
            dispatch({
              type: "CANCEL_SALE",
              playerId: player.id,
              assetId: asset.id,
            })
          }
        >
          Cancel listing
        </button>
      )}
    </div>
  );
}
