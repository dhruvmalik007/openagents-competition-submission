import type { PublishedSimulationRun, SimulationRunRecord } from '../types';
import { listArtifacts, readArtifact, writeArtifact } from './storage';

const PREFIX = 'simulation-runs';

export async function publishSimulationRun(run: Omit<PublishedSimulationRun, 'publishedAt'>): Promise<PublishedSimulationRun> {
  const published: PublishedSimulationRun = {
    ...run,
    publishedAt: new Date().toISOString()
  };

  await writeArtifact(`${PREFIX}/${published.manifest.runId}.json`, `${JSON.stringify(published, null, 2)}\n`);
  return published;
}

export async function listPublishedSimulationRuns(): Promise<SimulationRunRecord[]> {
  const artifactPaths = await listArtifacts(PREFIX);
  const runs = await Promise.all(
    artifactPaths
      .filter((path) => path.endsWith('.json'))
      .map(async (path) => {
        const content = await readArtifact(path);
        if (!content) return null;
        try {
          const parsed = JSON.parse(content) as PublishedSimulationRun;
          return {
            ...parsed.manifest,
            agentInstanceCount: parsed.manifest.protocols.reduce((sum, protocol) => sum + protocol.episodeCount * 4, 0),
            epochLogs: parsed.epochLogs,
            source: 'published-api' as const
          } satisfies SimulationRunRecord;
        } catch {
          return null;
        }
      })
  );

  const publishedRuns: SimulationRunRecord[] = runs.flatMap((run) => (run ? [run] : []));

  return publishedRuns.sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}