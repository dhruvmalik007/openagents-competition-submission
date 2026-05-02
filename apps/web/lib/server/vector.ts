import { createHash, randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import type { VectorDocumentRecord, VectorSearchInput, VectorSpec, VectorUpsertInput } from '../types';
import { env } from './env';
import { ensureDatabaseSchema, getSqlClient } from './db';
import { getLocalVectorStorePath } from './paths';

function hashToken(token: string): number {
  const digest = createHash('sha256').update(token).digest();
  return digest.readUInt32BE(0);
}

export function embedText(content: string, dimension = env.vectorDimension): number[] {
  const vector = new Array<number>(dimension).fill(0);
  const tokens = content.toLowerCase().split(/\s+/).filter(Boolean);
  const normalizedTokens = tokens.length > 0 ? tokens : ['empty'];

  for (const token of normalizedTokens) {
    const seed = hashToken(token);
    for (let i = 0; i < 8; i += 1) {
      const index = (seed + i * 2654435761) % dimension;
      vector[index] += ((seed >> (i % 24)) & 255) / 255;
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => value / magnitude);
}

function cosineSimilarity(left: number[], right: number[]): number {
  let score = 0;
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) {
    score += left[i] * right[i];
  }
  return score;
}

function parseLocalVectorStore(): Array<VectorDocumentRecord & { embedding: number[] }> {
  try {
    return readFileSync(getLocalVectorStorePath(), 'utf8')
      .split('\n')
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as VectorDocumentRecord & { embedding: number[] }];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

export async function upsertVectorDocument(input: VectorUpsertInput): Promise<VectorDocumentRecord> {
  const embedding = embedText(input.content);
  const now = new Date().toISOString();
  const record: VectorDocumentRecord = {
    id: randomUUID(),
    userId: input.userId,
    safeAddress: input.safeAddress,
    namespace: input.namespace,
    documentType: input.documentType,
    content: input.content,
    metadata: input.metadata ?? {},
    embeddingModel: env.embeddingModel,
    createdAt: now,
    updatedAt: now
  };

  const sql = getSqlClient();
  if (sql) {
    await ensureDatabaseSchema();
    const contentSha = createHash('sha256').update(input.content).digest('hex');
    const vectorLiteral = `[${embedding.join(',')}]`;
    await sql.unsafe(
      `insert into user_vector_documents (id, user_id, safe_address, namespace, document_type, content, metadata, content_sha256, embedding, embedding_model, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::vector,$10,$11,$12)`,
      [
        record.id,
        record.userId,
        record.safeAddress,
        record.namespace,
        record.documentType,
        record.content,
        JSON.stringify(record.metadata),
        contentSha,
        vectorLiteral,
        record.embeddingModel,
        record.createdAt,
        record.updatedAt
      ]
    );
    return record;
  }

  appendFileSync(getLocalVectorStorePath(), `${JSON.stringify({ ...record, embedding })}\n`, 'utf8');
  return record;
}

export async function searchVectorDocuments(input: VectorSearchInput): Promise<VectorDocumentRecord[]> {
  const embedding = embedText(input.query);
  const limit = input.limit ?? 5;
  const sql = getSqlClient();

  if (sql) {
    await ensureDatabaseSchema();
    const vectorLiteral = `[${embedding.join(',')}]`;
    const rows = await sql.unsafe(
      `select id, user_id as "userId", safe_address as "safeAddress", namespace, document_type as "documentType", content, metadata,
        embedding_model as "embeddingModel", created_at as "createdAt", updated_at as "updatedAt",
        1 - (embedding <=> $1::vector) as similarity
       from user_vector_documents
       where user_id = $2 and safe_address = $3 and namespace = $4
       order by embedding <=> $1::vector asc
       limit $5`,
      [vectorLiteral, input.userId, input.safeAddress, input.namespace, limit]
    ) as Array<VectorDocumentRecord>;
    return rows;
  }

  return parseLocalVectorStore()
    .filter((record) => record.userId === input.userId && record.safeAddress === input.safeAddress && record.namespace === input.namespace)
    .map((record) => ({
      ...record,
      similarity: cosineSimilarity(embedding, record.embedding)
    }))
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0))
    .slice(0, limit);
}

export async function countVectorDocuments(): Promise<number> {
  const sql = getSqlClient();
  if (sql) {
    await ensureDatabaseSchema();
    const rows = await sql<{ count: string }[]>`select count(*)::text as count from user_vector_documents`;
    return Number(rows[0]?.count ?? 0);
  }

  return parseLocalVectorStore().length;
}

export function getVectorSpec(): VectorSpec {
  return {
    provider: getSqlClient() ? 'neon-pgvector' : 'local-json',
    dimension: env.vectorDimension,
    embeddingModel: env.embeddingModel,
    tables: [
      {
        name: 'user_vector_documents',
        purpose: 'Per-user long-term memory, ETL fragments, protocol notes, and RLHF prompts used by the simulation and research loops.',
        keyColumns: ['user_id', 'safe_address', 'namespace', 'embedding']
      },
      {
        name: 'user_rlhf_feedback',
        purpose: 'Reward-shaped user feedback attached to runs and protocols for policy tuning and replay triage.',
        keyColumns: ['user_id', 'safe_address', 'run_id', 'reward_signal']
      },
      {
        name: 'published_cli_sessions',
        purpose: 'Published CLI-authenticated wallet sessions that let the web backend map a Safe-controlled identity to dashboard context.',
        keyColumns: ['session_id', 'safe_address', 'signer_address']
      }
    ],
    storageLayout: {
      jsonlBlobs: [
        'etl/datasets/protocols.jsonl',
        'etl/datasets/simulations.jsonl',
        'etl/datasets/epochs.jsonl',
        'vector/documents.jsonl'
      ],
      database: ['user_vector_documents', 'user_rlhf_feedback', 'published_cli_sessions']
    },
    guarantees: [
      'Each user is isolated by user_id + safe_address + namespace filters.',
      'Embeddings are normalized before persistence for cosine similarity search.',
      'Blob/JSONL outputs remain append-oriented while the vector layer supports low-latency retrieval.',
      'The schema can run locally without a database and promote to Neon/pgvector on Vercel with the same API surface.'
    ]
  };
}
