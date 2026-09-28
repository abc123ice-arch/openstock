import { connectToDatabase } from '@/database/mongoose';
import { MarketCoin, VolumeBaseline, median, scoreCoin } from './score';

const COLLECTION = 'crypto_radar_snapshots';
const PAGES = 4; // CoinGecko market-cap ranks 1–1000, plus user examples.
const TRACKED_IDS = ['quant-network', 'tevaera'];

async function fetchMarketPage(params: URLSearchParams): Promise<MarketCoin[]> {
  const headers: HeadersInit = { accept: 'application/json' };
  if (process.env.COINGECKO_DEMO_API_KEY) headers['x-cg-demo-api-key'] = process.env.COINGECKO_DEMO_API_KEY;
  const response = await fetch(`https://api.coingecko.com/api/v3/coins/markets?${params}`, {
    headers, next: { revalidate: 900 }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`CoinGecko market data unavailable (${response.status})`);
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid market data response');
  return data as MarketCoin[];
}

export async function fetchCoins(): Promise<MarketCoin[]> {
  const common = { vs_currency: 'usd', order: 'market_cap_desc', per_page: '250',
    sparkline: 'false', price_change_percentage: '1h,24h,7d' };
  const requests = Array.from({ length: PAGES }, (_, i) =>
    fetchMarketPage(new URLSearchParams({ ...common, page: String(i + 1) })));
  requests.push(fetchMarketPage(new URLSearchParams({ ...common, ids: TRACKED_IDS.join(',') })));
  const pages = await Promise.all(requests);
  return [...new Map(pages.flat().map(coin => [coin.id, coin])).values()];
}

type Snapshot = { coinId: string; volume24h: number; collectedAt: Date };

export async function baselinesFor(coins: MarketCoin[]): Promise<Map<string, VolumeBaseline>> {
  const baselines = new Map<string, VolumeBaseline>();
  if (!process.env.MONGODB_URI) return baselines;
  const db = (await connectToDatabase()).connection.db;
  if (!db) throw new Error('MongoDB unavailable');
  const snapshots = await db.collection<Snapshot>(COLLECTION).find({
    coinId: { $in: coins.map(c => c.id) },
    collectedAt: { $gte: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) },
  }).project<Snapshot>({ coinId: 1, volume24h: 1, collectedAt: 1 }).toArray();
  const groups = new Map<string, Snapshot[]>();
  for (const item of snapshots) groups.set(item.coinId, [...(groups.get(item.coinId) ?? []), item]);
  for (const [id, rows] of groups) {
    // One measurement per UTC day; daily 24h rolling volume otherwise creates
    // pseudo-replication if collection cadence is increased later.
    const byDay = new Map<string, number>();
    for (const row of rows.sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime())) {
      const day = row.collectedAt.toISOString().slice(0, 10);
      if (row.volume24h > 0 && day !== new Date().toISOString().slice(0, 10)) byDay.set(day, row.volume24h);
    }
    const values = [...byDay.values()];
    baselines.set(id, { medianVolume: median(values), samples: values.length });
  }
  return baselines;
}

export async function getRadar() {
  const coins = await fetchCoins();
  const baselines = await baselinesFor(coins);
  const signals = coins.map(c => scoreCoin(c, baselines.get(c.id))).filter(s => s !== null);
  const priority = { 'early activity': 0, 'thin market': 1, momentum: 2, watch: 3 };
  signals.sort((a, b) => priority[a.category] - priority[b.category] || b.score - a.score);
  return { scanned: coins.length, collectedDays: Math.max(0, ...[...baselines.values()].map(b => b.samples)),
    generatedAt: new Date().toISOString(), signals };
}

export async function collectSnapshot(): Promise<number> {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI required for historical baselines');
  const coins = await fetchCoins();
  const db = (await connectToDatabase()).connection.db;
  if (!db) throw new Error('MongoDB unavailable');
  const collection = db.collection<Snapshot>(COLLECTION);
  await collection.createIndex({ collectedAt: 1 }, { expireAfterSeconds: 16 * 24 * 60 * 60 });
  await collection.createIndex({ coinId: 1, collectedAt: -1 });
  const collectedAt = new Date();
  const valid = coins.filter(c => typeof c.total_volume === 'number' && Number.isFinite(c.total_volume) && c.total_volume > 0);
  if (valid.length) await collection.insertMany(valid.map(c => ({ coinId: c.id, volume24h: c.total_volume!, collectedAt })));
  return valid.length;
}
