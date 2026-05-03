import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishCliSession } from '../../../../lib/server/auth';
import { isPrivyConfigured, verifyPrivyAccessToken } from '../../../../lib/server/privy';

const cliSessionSchema = z.object({
  sessionId: z.string(),
  safeAddress: z.string(),
  signerAddress: z.string(),
  rpcUrl: z.string(),
  mode: z.enum(['browser', 'private-key', 'ledger', 'privy']),
  issuedAt: z.string(),
  expiresAt: z.string(),
  challenge: z.string(),
  signature: z.string(),
  verifiedOwner: z.boolean()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization');
  const body = await request.json();
  const session = cliSessionSchema.parse(body);

  if (session.mode === 'privy' || authorization) {
    const accessToken = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : null;
    if (!accessToken) {
      return NextResponse.json({ error: 'Missing Privy access token.' }, { status: 401 });
    }

    if (isPrivyConfigured()) {
      try {
        await verifyPrivyAccessToken(accessToken);
      } catch {
        return NextResponse.json({ error: 'Invalid Privy access token.' }, { status: 401 });
      }
    }
  }

  const published = await publishCliSession(session);
  return NextResponse.json({ session: published });
}
