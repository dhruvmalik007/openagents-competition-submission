import { NextResponse } from 'next/server';
import { loadLocalCliSession, loadLatestPublishedCliSession } from '../../../../lib/server/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = loadLocalCliSession() ?? (await loadLatestPublishedCliSession());
  return NextResponse.json({ session });
}
