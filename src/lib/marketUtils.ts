import type { Market } from '../types/market';

export const isPolymarket = (market: Market) =>
  market.source === 'polymarket' || market.id.startsWith('poly_');

export const isMultiOutcome = (market: Market) => (market.outcomes?.length ?? 0) > 2;

export const getOutcomeTokenId = (market: Market, outcome: string) => {
  if (!market.tokenIds || market.tokenIds.length === 0) return null;
  const outcomes = market.outcomes ?? ['Yes', 'No'];
  const target = outcome.toLowerCase();
  const idx = outcomes.findIndex((o: string) => o.toLowerCase() === target);
  if (idx >= 0 && market.tokenIds[idx]) return market.tokenIds[idx];
  return market.tokenIds[0];
};

export const getOutcomePercent = (market: Market, side: string): number => {
  if (market.outcomes && market.outcomePrices) {
    const idx = market.outcomes.findIndex((o) => o === side);
    if (idx >= 0 && market.outcomePrices[idx] != null) {
      return market.outcomePrices[idx] * 100;
    }
  }
  return side === 'YES' ? market.yesPercent : market.noPercent;
};
