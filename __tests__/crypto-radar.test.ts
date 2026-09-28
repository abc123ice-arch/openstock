import { describe, expect, it } from 'vitest';
import { median, scoreCoin, type MarketCoin } from '@/lib/crypto-radar/score';

const coin: MarketCoin = {
  id: 'example-token', symbol: 'ex', name: 'Example', current_price: 1,
  market_cap: 50_000_000, total_volume: 5_000_000,
  price_change_percentage_1h_in_currency: 1,
  price_change_percentage_24h_in_currency: 3,
};

describe('crypto radar classification', () => {
  it('recognises rising reported activity before a large price move when baseline is sufficient', () => {
    const signal = scoreCoin(coin, { medianVolume: 1_000_000, samples: 5 })!;
    expect(signal.category).toBe('early activity');
    expect(signal.volumeMultiple).toBe(5);
    expect(signal.evidence[0]).toContain('5.0×');
  });
  it('does not invent an early alert before three daily baseline samples', () => {
    const signal = scoreCoin(coin, { medianVolume: 1_000_000, samples: 2 })!;
    expect(signal.category).toBe('watch');
    expect(signal.volumeMultiple).toBeNull();
  });
  it('flags a thin already-spiking coin as risky instead of early', () => {
    const signal = scoreCoin({ ...coin, market_cap: 500_000, total_volume: 20_000,
      price_change_percentage_24h_in_currency: 140 }, { medianVolume: 1_000, samples: 5 })!;
    expect(signal.category).toBe('thin market');
    expect(signal.cautions).toContain('Large move already underway; this is not an early alert');
  });
  it('uses a robust median and ignores invalid volumes', () => {
    expect(median([100, 120, 110, 1_000_000, -1, Number.NaN])).toBe(115);
  });
});
