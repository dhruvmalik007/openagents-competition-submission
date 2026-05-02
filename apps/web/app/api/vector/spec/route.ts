import { NextResponse } from 'next/server';
import { getVectorSpec } from '../../../../lib/server/vector';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getVectorSpec());
}
