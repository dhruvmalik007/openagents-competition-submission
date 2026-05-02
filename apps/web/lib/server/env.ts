import { z } from 'zod';

const envSchema = z.object({
  AEGIS_REPO_ROOT: z.string().optional(),
  AEGIS_DATA_ROOT: z.string().optional(),
  AEGIS_VECTOR_DIMENSION: z.coerce.number().default(1536),
  AEGIS_VECTOR_EMBEDDING_MODEL: z.string().default('deterministic-hash-v1'),
  AEGIS_OG_NETWORK: z.string().optional(),
  AEGIS_OG_RPC_URL: z.string().optional(),
  AEGIS_OG_INDEXER_RPC_URL: z.string().optional(),
  AEGIS_OG_PRIVATE_KEY: z.string().optional(),
  AEGIS_OG_PROVIDER_ADDRESS: z.string().optional(),
  AEGIS_OG_INFERENCE_API_KEY: z.string().optional(),
  AEGIS_OG_INFERENCE_SERVICE_URL: z.string().optional(),
  POSTGRES_URL: z.string().optional(),
  DATABASE_URL: z.string().optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional()
});

const parsed = envSchema.parse({
  AEGIS_REPO_ROOT: process.env.AEGIS_REPO_ROOT,
  AEGIS_DATA_ROOT: process.env.AEGIS_DATA_ROOT,
  AEGIS_VECTOR_DIMENSION: process.env.AEGIS_VECTOR_DIMENSION,
  AEGIS_VECTOR_EMBEDDING_MODEL: process.env.AEGIS_VECTOR_EMBEDDING_MODEL,
  AEGIS_OG_NETWORK: process.env.AEGIS_OG_NETWORK,
  AEGIS_OG_RPC_URL: process.env.AEGIS_OG_RPC_URL,
  AEGIS_OG_INDEXER_RPC_URL: process.env.AEGIS_OG_INDEXER_RPC_URL,
  AEGIS_OG_PRIVATE_KEY: process.env.AEGIS_OG_PRIVATE_KEY,
  AEGIS_OG_PROVIDER_ADDRESS: process.env.AEGIS_OG_PROVIDER_ADDRESS,
  AEGIS_OG_INFERENCE_API_KEY: process.env.AEGIS_OG_INFERENCE_API_KEY,
  AEGIS_OG_INFERENCE_SERVICE_URL: process.env.AEGIS_OG_INFERENCE_SERVICE_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN
});

export const env = {
  repoRoot: parsed.AEGIS_REPO_ROOT,
  dataRoot: parsed.AEGIS_DATA_ROOT,
  vectorDimension: parsed.AEGIS_VECTOR_DIMENSION,
  embeddingModel: parsed.AEGIS_VECTOR_EMBEDDING_MODEL,
  ogNetwork: parsed.AEGIS_OG_NETWORK,
  ogRpcUrl: parsed.AEGIS_OG_RPC_URL,
  ogIndexerRpcUrl: parsed.AEGIS_OG_INDEXER_RPC_URL,
  ogPrivateKey: parsed.AEGIS_OG_PRIVATE_KEY,
  ogProviderAddress: parsed.AEGIS_OG_PROVIDER_ADDRESS,
  ogInferenceApiKey: parsed.AEGIS_OG_INFERENCE_API_KEY,
  ogInferenceServiceUrl: parsed.AEGIS_OG_INFERENCE_SERVICE_URL,
  databaseUrl: parsed.DATABASE_URL ?? parsed.POSTGRES_URL,
  blobConfigured: Boolean(parsed.BLOB_READ_WRITE_TOKEN)
};
