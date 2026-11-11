import { assetValue } from "./economy";
import { saleQuote } from "./market";
import type { Asset, GameState } from "./types";

export const QUICK_SALE_DISCOUNT_BPS = {
  stock: 0,
  business: 500,
  property: 1500,
};

/** Listing prices are agreed now; loan balances and closing costs settle later. */
export function voluntarySaleQuote(game: GameState, asset: Asset) {
  const value = assetValue(game, asset);
  const discountBps =
    asset.listing?.discountBps ?? QUICK_SALE_DISCOUNT_BPS[asset.category];
  const gross =
    asset.listing?.gross ?? Math.round((value * (10000 - discountBps)) / 10000);
  return {
    ...saleQuote(game, asset, gross),
    marketValue: value,
    discountBps,
    discount: asset.listing
      ? Math.round((gross * discountBps) / (10000 - discountBps))
      : value - gross,
  };
}
