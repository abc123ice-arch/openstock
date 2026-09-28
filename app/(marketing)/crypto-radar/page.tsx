import { getRadar } from '@/lib/crypto-radar/data';
import type { RadarSignal } from '@/lib/crypto-radar/score';

export const metadata = { title: 'Crypto Radar | OpenStock', description: 'Evidence-based crypto market anomaly scanner' };
export const dynamic = 'force-dynamic';

const usd = (n: number | null) => n === null ? 'Unknown' :
  Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 4 }).format(n);
const compact = (n: number | null) => n === null ? 'Unknown' :
  Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const change = (n: number | null) => n === null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;

function Signal({ signal }: { signal: RadarSignal }) {
  return <article className="rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <a className="text-lg font-bold text-foreground underline-offset-4 hover:underline" href={signal.sourceUrl} target="_blank" rel="noopener noreferrer">{signal.name} <span className="text-sm text-muted-foreground">{signal.symbol}</span></a>
        <p className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{signal.category} · market anomaly score {signal.score}/100</p>
      </div>
      <p className="font-mono text-lg font-semibold">{usd(signal.price)}</p>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div><span className="block text-xs text-muted-foreground">1h</span>{change(signal.change1h)}</div>
      <div><span className="block text-xs text-muted-foreground">24h</span>{change(signal.change24h)}</div>
      <div><span className="block text-xs text-muted-foreground">24h reported volume</span>${compact(signal.volume24h)}</div>
      <div><span className="block text-xs text-muted-foreground">Market cap</span>${compact(signal.marketCap)}</div>
    </div>
    {signal.evidence.length > 0 && <div className="mt-4"><p className="text-xs font-semibold uppercase tracking-wider">Observed</p><ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">{signal.evidence.map(e => <li key={e}>{e}</li>)}</ul></div>}
    <div className="mt-3"><p className="text-xs font-semibold uppercase tracking-wider">Check before interpreting</p><ul className="mt-1 list-inside list-disc text-sm text-muted-foreground">{signal.cautions.map(c => <li key={c}>{c}</li>)}</ul></div>
    <p className="mt-3 text-xs text-muted-foreground">CoinGecko observation {signal.asOf ? new Date(signal.asOf).toLocaleString('en-GB', { timeZone: 'UTC' }) + ' UTC' : 'time unknown'} · <a className="underline" href={signal.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></p>
  </article>;
}

export default async function CryptoRadarPage() {
  let radar: Awaited<ReturnType<typeof getRadar>> | null = null;
  try { radar = await getRadar(); } catch (error) { console.error('Crypto radar page:', error); }
  const noteworthy = radar?.signals.filter(s => s.category !== 'watch').slice(0, 30) ?? [];
  return <div className="mx-auto max-w-[1200px] px-5 py-12">
    <p className="text-sm font-bold uppercase tracking-widest text-brand-ink">Research preview</p>
    <h1 className="mt-2 text-4xl font-bold tracking-tight">Crypto Radar</h1>
    <p className="mt-3 max-w-3xl text-muted-foreground">Spot unusual activity across smaller cryptocurrencies. Scores rank observable market anomalies; they do not predict gains or establish why a move happened.</p>
    <div className="mt-7 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
      {radar ? <p>Scanned {radar.scanned} coins · refreshed {new Date(radar.generatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC · {radar.collectedDays >= 3 ? `up to ${radar.collectedDays} observed daily baselines` : 'baseline warming up: volume comparisons need 3 collection days'}</p> : <p>Market feed unavailable. Check your CoinGecko access and try again shortly.</p>}
      <p className="mt-2">Coverage: CoinGecko market-cap ranks 1–1000 plus QNT and TEVA. Very new or unlisted tokens may be missed. Reported volume is not order-book depth; no catalyst, exchange flow, wallet, social or token-unlock verification is included yet.</p>
    </div>
    {radar && <><div className="mt-10 flex flex-wrap items-end justify-between gap-3"><h2 className="text-2xl font-bold">Activity to investigate</h2><p className="text-sm text-muted-foreground">{noteworthy.length} shown · strongest category first</p></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{noteworthy.map(s => <Signal key={s.id} signal={s} />)}</div>
      {noteworthy.length === 0 && <p className="mt-5 text-muted-foreground">No notable moves in the current scan.</p>}
      <h2 className="mt-12 text-2xl font-bold">Your examples</h2>
      <p className="mt-2 text-sm text-muted-foreground">These cards show current market observations, not a retrospective backtest of the screenshots.</p>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">{['quant-network', 'tevaera'].map(id => {
        const signal = radar!.signals.find(s => s.id === id);
        return signal ? <Signal key={id} signal={signal} /> : <p key={id} className="rounded-xl border border-border p-5 text-muted-foreground">{id}: no current data from the provider.</p>;
      })}</div></>}
  </div>;
}
