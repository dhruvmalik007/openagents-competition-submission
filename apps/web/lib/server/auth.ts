import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import crypto from 'node:crypto';
import type { CliSession, PublishedCliSession } from '../types';
import { ensureDatabaseSchema, getSqlClient } from './db';
import { getPublishedSessionsDir } from './paths';

function getLocalCliSessionPath(): string {
  const aegisHome = process.env.AEGIS_HOME?.trim() || join(homedir(), '.aegis-arena');
  mkdirSync(aegisHome, { recursive: true });
  return join(aegisHome, 'session.json');
}

export function loadLocalCliSession(): PublishedCliSession | null {
  try {
    const parsed = JSON.parse(readFileSync(getLocalCliSessionPath(), 'utf8')) as CliSession;
    return {
      ...parsed,
      publishedAt: parsed.issuedAt,
      source: 'local-cli'
    };
  } catch {
    return null;
  }
}

export async function publishCliSession(session: CliSession): Promise<PublishedCliSession> {
  const published: PublishedCliSession = {
    ...session,
    publishedAt: new Date().toISOString(),
    source: 'api'
  };

  const targetDir = getPublishedSessionsDir();
  const filePath = join(targetDir, `${published.sessionId}.json`);
  writeFileSync(filePath, `${JSON.stringify(published, null, 2)}\n`, 'utf8');

  const sql = getSqlClient();
  if (sql) {
    await ensureDatabaseSchema();
    await sql`
      insert into published_cli_sessions (
        session_id, safe_address, signer_address, rpc_url, mode, issued_at, expires_at, challenge, signature, verified_owner, published_at
      ) values (
        ${published.sessionId}, ${published.safeAddress}, ${published.signerAddress}, ${published.rpcUrl}, ${published.mode},
        ${published.issuedAt}, ${published.expiresAt}, ${published.challenge}, ${published.signature}, ${published.verifiedOwner}, ${published.publishedAt}
      )
      on conflict (session_id) do update set
        safe_address = excluded.safe_address,
        signer_address = excluded.signer_address,
        rpc_url = excluded.rpc_url,
        mode = excluded.mode,
        issued_at = excluded.issued_at,
        expires_at = excluded.expires_at,
        challenge = excluded.challenge,
        signature = excluded.signature,
        verified_owner = excluded.verified_owner,
        published_at = excluded.published_at
    `;
  }

  return published;
}

export async function loadLatestPublishedCliSession(): Promise<PublishedCliSession | null> {
  const localSession = loadLocalCliSession();
  if (localSession) return localSession;

  const sql = getSqlClient();
  if (sql) {
    await ensureDatabaseSchema();
    const rows = await sql<PublishedCliSession[]>`
      select session_id as "sessionId", safe_address as "safeAddress", signer_address as "signerAddress", rpc_url as "rpcUrl",
        mode, issued_at as "issuedAt", expires_at as "expiresAt", challenge, signature, verified_owner as "verifiedOwner",
        published_at as "publishedAt"
      from published_cli_sessions
      order by published_at desc
      limit 1
    `;
    if (rows.length > 0) {
      return { ...rows[0], source: 'api' };
    }
  }

  try {
    const dir = getPublishedSessionsDir();
    const files = readdirSync(dir).filter((entry) => entry.endsWith('.json')).sort().reverse();
    for (const file of files) {
      try {
        return JSON.parse(readFileSync(join(dir, file), 'utf8')) as PublishedCliSession;
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export function computeUserIdFromSession(session: Pick<CliSession, 'safeAddress' | 'signerAddress'>): string {
  return crypto.createHash('sha256').update(`${session.safeAddress}:${session.signerAddress}`).digest('hex');
}
