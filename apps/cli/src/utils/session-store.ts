import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type SafeSession = {
  sessionId: string;
  safeAddress: string;
  signerAddress: string;
  rpcUrl: string;
  mode: 'browser' | 'private-key' | 'ledger';
  issuedAt: string;
  expiresAt: string;
  challenge: string;
  signature: string;
  verifiedOwner: boolean;
};

export function getAegisHome(): string {
  const baseDir = process.env.AEGIS_HOME?.trim() || join(homedir(), '.aegis-arena');
  mkdirSync(baseDir, { recursive: true });
  return baseDir;
}

export function getSessionPath(): string {
  return join(getAegisHome(), 'session.json');
}

export function getFaucetClaimsDir(): string {
  const dir = join(getAegisHome(), 'faucet-claims');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveSession(session: SafeSession): void {
  writeFileSync(getSessionPath(), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
}

export function loadSession(): SafeSession | null {
  try {
    return JSON.parse(readFileSync(getSessionPath(), 'utf8')) as SafeSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  rmSync(getSessionPath(), { force: true });
}