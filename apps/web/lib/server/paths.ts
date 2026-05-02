import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { env } from './env';

export function getRepoRoot(): string {
  return env.repoRoot ? resolve(env.repoRoot) : resolve(process.cwd(), '..', '..');
}

export function getDataRoot(): string {
  const root = env.dataRoot ? resolve(env.dataRoot) : join(getRepoRoot(), 'runs', 'web-data');
  if (!existsSync(root)) {
    mkdirSync(root, { recursive: true });
  }
  return root;
}

export function getInventoryDir(): string {
  return join(getRepoRoot(), 'data', 'inventory', 'protocols');
}

export function getRunsDir(): string {
  return join(getRepoRoot(), 'runs', 'rl-sim');
}

export function getPublishedSessionsDir(): string {
  const dir = join(getDataRoot(), 'auth', 'cli-sessions');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getEtlJobsDir(): string {
  const dir = join(getDataRoot(), 'etl', 'jobs');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getEtlDatasetsDir(): string {
  const dir = join(getDataRoot(), 'etl', 'datasets');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function getLocalVectorStorePath(): string {
  const dir = join(getDataRoot(), 'vector');
  mkdirSync(dir, { recursive: true });
  return join(dir, 'documents.jsonl');
}
