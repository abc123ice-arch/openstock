export type MarketCoin = {
  id: string; symbol: string; name: string; current_price: number | null;
  market_cap: number | null; total_volume: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_24h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  last_updated?: string;
};

export type VolumeBaseline = { medianVolume: number; samples: number };
export type RadarSignal = {
  id: string; symbol: string; name: string; price: number | null;
  marketCap: number | null; volume24h: number; change1h: number | null;
  change24h: number | null; change7d: number | null;
  volumeMultiple: number | null; baselineSamples: number;
  turnover: number | null; score: number; category: 'early activity' | 'momentum' | 'thin market' | 'watch';
  evidence: string[]; cautions: string[]; sourceUrl: string; asOf: string | null;
};

const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const percent = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

// The baseline is a median of daily snapshots at least 18 hours apart. It is
// deliberately unavailable until three independent days have been observed.
export function scoreCoin(coin: MarketCoin, baseline?: VolumeBaseline): RadarSignal | null {
  if (!coin.id || !coin.symbol || !finite(coin.total_volume) || coin.total_volume <= 0) return null;
  const volume = coin.total_volume;
  const cap = finite(coin.market_cap) && coin.market_cap > 0 ? coin.market_cap : null;
  const hour = finite(coin.price_change_percentage_1h_in_currency) ? coin.price_change_percentage_1h_in_currency : null;
  const day = finite(coin.price_change_percentage_24h_in_currency) ? coin.price_change_percentage_24h_in_currency : null;
  const week = finite(coin.price_change_percentage_7d_in_currency) ? coin.price_change_percentage_7d_in_currency : null;
  const turnover = cap ? volume / cap : null;
  const multiple = baseline && baseline.samples >= 3 && baseline.medianVolume > 0
    ? volume / baseline.medianVolume : null;
  const thin = volume < 100_000 || cap === null || cap < 1_000_000;
  const extreme = (day ?? 0) > 40 || (hour ?? 0) > 15;
  const early = multiple !== null && multiple >= 2.5 && (day ?? 0) < 8 && (day ?? 0) > -8 && !thin;
  const evidence: string[] = [];
  const cautions: string[] = [];
  if (multiple !== null && multiple >= 1.5) evidence.push(`24h volume ${multiple.toFixed(1)}× its ${baseline!.samples}-day observed median`);
  if (hour !== null && Math.abs(hour) >= 2) evidence.push(`1h price change ${percent(hour)}`);
  if (day !== null && Math.abs(day) >= 5) evidence.push(`24h price change ${percent(day)}`);
  if (turnover !== null && turnover > 0.25) evidence.push(`24h volume / market cap ${(turnover * 100).toFixed(0)}% (turnover proxy, not liquidity)`);
  if (multiple === null) cautions.push('No multi-day volume baseline yet');
  if (volume < 100_000) cautions.push('Under $100k reported 24h volume; price may move on small trades');
  if (cap === null) cautions.push('Market cap unavailable');
  else if (cap < 1_000_000) cautions.push('Market cap below $1m');
  if (extreme) cautions.push('Large move already underway; this is not an early alert');
  cautions.push('Catalyst, order-book depth and on-chain activity have not been verified');
  const score = clamp(Math.round(
    (multiple === null ? 0 : clamp(Math.log2(Math.max(1, multiple)) * 18, 0, 42)) +
    clamp(Math.max(0, hour ?? 0) * 2, 0, 20) +
    clamp(Math.max(0, day ?? 0) * 0.6, 0, 20) +
    (turnover === null ? 0 : clamp(turnover * 25, 0, 18)) -
    (thin ? 18 : 0) - (extreme ? 8 : 0)
  ), 0, 100);
  return {
    id: coin.id, symbol: coin.symbol.toUpperCase(), name: coin.name,
    price: finite(coin.current_price) ? coin.current_price : null,
    marketCap: cap, volume24h: volume, change1h: hour, change24h: day,
    change7d: week, volumeMultiple: multiple, baselineSamples: baseline?.samples ?? 0,
    turnover, score, category: thin ? 'thin market' : early ? 'early activity' :
      extreme || (day ?? 0) >= 8 ? 'momentum' : 'watch',
    evidence, cautions, sourceUrl: `https://www.coingecko.com/en/coins/${encodeURIComponent(coin.id)}`,
    asOf: coin.last_updated ?? null,
  };
}

export function median(numbers: number[]): number {
  const sorted = numbers.filter(n => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
