import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EpochLog, InventoryRecord, SimulationManifest } from '../types';
import { getInventoryDir, getRunsDir } from './paths';

function safeReadJson<T>(filePath: string): T | null {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return null;
  }
}

export function listInventories(): InventoryRecord[] {
  const dir = getInventoryDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((entry) => entry.endsWith('.json'))
    .sort()
    .flatMap((entry) => {
      const record = safeReadJson<InventoryRecord>(join(dir, entry));
      return record ? [record] : [];
    });
}

export function listSimulationRuns(): SimulationManifest[] {
  const dir = getRunsDir();
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .sort()
    .flatMap((entry) => {
      const manifest = safeReadJson<SimulationManifest>(join(dir, entry, 'manifest.json'));
      return manifest ? [manifest] : [];
    })
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
}

export function listEpochLogs(runId: string): EpochLog[] {
  const filePath = join(getRunsDir(), runId, 'epoch-logs.jsonl');
  if (!existsSync(filePath)) return [];

  return readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as EpochLog];
      } catch {
        return [];
      }
    });
}
