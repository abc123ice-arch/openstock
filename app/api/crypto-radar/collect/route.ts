import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { collectSnapshot } from '@/lib/crypto-radar/data';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? '';
  if (!secret || !supplied || supplied.length !== secret.length ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ collected: await collectSnapshot(), at: new Date().toISOString() });
  } catch (error) {
    console.error('Crypto radar collection failed:', error);
    return NextResponse.json({ error: 'Collection failed' }, { status: 503 });
  }
}
