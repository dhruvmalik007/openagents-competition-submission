import { NextResponse } from 'next/server';
import { listEtlJobs } from '../../../../lib/server/etl';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await listEtlJobs());
}
