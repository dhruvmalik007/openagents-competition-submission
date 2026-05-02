import { NextResponse } from 'next/server';
import { runEtl } from '../../../../lib/server/etl';

export const dynamic = 'force-dynamic';

function resolveSource(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get('source') as 'manual' | 'cron' | 'api' | null) ?? 'manual';
}

export async function GET(request: Request) {
  const source = request.headers.get('user-agent')?.includes('vercel-cron') ? 'cron' : resolveSource(request);
  const job = await runEtl(source);
  return NextResponse.json(job);
}

export async function POST(request: Request) {
  const source = resolveSource(request);
  const job = await runEtl(source);
  return NextResponse.json(job);
}
