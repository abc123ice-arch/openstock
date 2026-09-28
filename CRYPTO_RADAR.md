# Crypto Radar research preview

Visit `/crypto-radar` for a read-only scan of CoinGecko market-cap ranks 1–1000, plus QNT and TEVA. `/api/crypto-radar` returns the same data as JSON. No trades or buy recommendations are made.

## Setup

- Set `COINGECKO_DEMO_API_KEY` (server only) for an authenticated Demo API allocation. Keyless requests may work for local evaluation, subject to provider limits.
- Set `MONGODB_URI` to retain daily reported 24-hour-volume snapshots.
- Set a strong `CRON_SECRET` for the protected collection endpoint. `vercel.json` schedules `GET /api/crypto-radar/collect` at 01:00 UTC daily; Vercel cron supplies `Authorization: Bearer <CRON_SECRET>`. Locally, run `curl -H "Authorization: Bearer YOUR_SECRET" http://localhost:3000/api/crypto-radar/collect` once daily. Do not expose the secret to the browser.
- The first meaningful baseline appears after three **previous UTC days** of collection. Snapshots expire after 16 days. The median considers previous distinct days and excludes today's data.

The scan makes five market requests per fetch (four pages plus explicitly tracked IDs). Next.js caches each upstream request for 15 minutes; the JSON endpoint uses a 15-minute shared-cache header. Tune cadence against your provider's current plan and rate limits.

## Interpretation and limits

“Early activity” requires reported 24-hour volume at least 2.5 times its observed median, a relatively flat 24-hour price (within ±8%), at least three previous days of baseline, and more than $100k of reported daily volume and $1m market cap. A thin market receives a separate caution even when its volume multiplies. “Momentum” means the move is underway; “watch” means current evidence is insufficient. The 0–100 score ranks market anomalies, **not** probability of a future rise.

CoinGecko reported volume aggregates venues and may contain unreliable activity. Market cap and reported volume do not measure executable liquidity. This version has no verified news/catalysts, social, wallet, order-book, exchange-flow or token unlock feeds. It cannot conclude *why* a coin spiked. The screenshot dates cannot be backtested from today's snapshots; replay needs historical point-in-time price and volume and timestamped catalyst evidence, including sources that existed before each alert.

This fork remains under the upstream AGPL-3.0 licence. Review that licence before deploying a commercial hosted version.
