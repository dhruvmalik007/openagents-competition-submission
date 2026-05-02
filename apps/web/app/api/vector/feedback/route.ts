import { NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertVectorDocument } from '../../../../lib/server/vector';

const feedbackSchema = z.object({
  userId: z.string(),
  safeAddress: z.string(),
  namespace: z.string().default('default'),
  feedbackText: z.string().min(1),
  rewardSignal: z.number().min(-1).max(1),
  runId: z.string().optional(),
  protocolSlug: z.string().optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = feedbackSchema.parse(await request.json());
  const record = await upsertVectorDocument({
    userId: body.userId,
    safeAddress: body.safeAddress,
    namespace: body.namespace,
    documentType: 'rlhf-feedback',
    content: body.feedbackText,
    metadata: {
      rewardSignal: body.rewardSignal,
      runId: body.runId,
      protocolSlug: body.protocolSlug
    }
  });
  return NextResponse.json({ record });
}
