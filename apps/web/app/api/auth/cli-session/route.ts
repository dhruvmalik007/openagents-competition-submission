import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishCliSession } from '../../../../lib/server/auth';

const cliSessionSchema = z.object({
  sessionId: z.string(),
  safeAddress: z.string(),
  signerAddress: z.string(),
  rpcUrl: z.string(),
  mode: z.enum(['browser', 'private-key', 'ledger']),
  issuedAt: z.string(),
  expiresAt: z.string(),
  challenge: z.string(),
  signature: z.string(),
  verifiedOwner: z.boolean()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json();
  const session = cliSessionSchema.parse(body);
  const published = await publishCliSession(session);
  return NextResponse.json({ session: published });
}
