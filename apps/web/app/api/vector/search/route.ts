import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchVectorDocuments } from '../../../../lib/server/vector';

const searchSchema = z.object({
  userId: z.string(),
  safeAddress: z.string(),
  namespace: z.string().default('default'),
  query: z.string().min(1),
  limit: z.number().int().positive().max(20).optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = searchSchema.parse(await request.json());
  const results = await searchVectorDocuments(body);
  return NextResponse.json({ results });
}
