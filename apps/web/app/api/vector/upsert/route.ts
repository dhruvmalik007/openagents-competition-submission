import { NextResponse } from 'next/server';
import { z } from 'zod';
import { upsertVectorDocument } from '../../../../lib/server/vector';

const upsertSchema = z.object({
  userId: z.string(),
  safeAddress: z.string(),
  namespace: z.string().default('default'),
  documentType: z.enum(['run-memory', 'protocol-note', 'rlhf-feedback', 'etl-fragment']),
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = upsertSchema.parse(await request.json());
  const record = await upsertVectorDocument(body);
  return NextResponse.json({ record });
}
