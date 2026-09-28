import { NextResponse } from 'next/server';
import { getRadar } from '@/lib/crypto-radar/data';

export async function GET() {
  try {
    return NextResponse.json(await getRadar(), { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=300' } });
  } catch (error) {
    console.error('Crypto radar failed:', error);
    return NextResponse.json({ error: 'Market feed unavailable. Try again later.' }, { status: 503 });
  }
}
