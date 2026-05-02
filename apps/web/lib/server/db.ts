import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres, { type Sql } from 'postgres';
import { env } from './env';

let sqlClient: Sql | null = null;
let schemaReadyPromise: Promise<void> | null = null;

export function getSqlClient(): Sql | null {
  if (!env.databaseUrl) return null;
  if (!sqlClient) {
    sqlClient = postgres(env.databaseUrl, {
      prepare: false,
      max: 1
    });
  }
  return sqlClient;
}

export async function ensureDatabaseSchema(): Promise<void> {
  const sql = getSqlClient();
  if (!sql) return;
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const schemaPath = join(process.cwd(), 'db', 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');
      await sql.unsafe(schemaSql);
    })();
  }
  await schemaReadyPromise;
}
