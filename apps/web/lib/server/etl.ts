import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { EtlJobRecord, EtlDatasetName } from '../types';
import { loadLatestPublishedCliSession } from './auth';
import { env } from './env';
import { listEpochLogs, listInventories, listSimulationRuns } from './local-repository';
import { getEtlDatasetsDir, getEtlJobsDir, getRunsDir } from './paths';
import { listArtifacts, readArtifact, writeArtifact } from './storage';
import { build0GModuleChecks, fetchRekt2026Incidents, fetchSoloditFindings } from './threat-intel';

function writeLocalJob(job: EtlJobRecord) {
  const target = join(getEtlJobsDir(), `${job.jobId}.json`);
  writeFileSync(target, `${JSON.stringify(job, null, 2)}\n`, 'utf8');
}

export async function listEtlJobs(): Promise<EtlJobRecord[]> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const artifactPaths = await listArtifacts('etl/jobs');
    const jobs = await Promise.all(
      artifactPaths
        .filter((path) => path.endsWith('.json'))
        .map(async (path) => {
          const content = await readArtifact(path);
          if (!content) return null;
          try {
            return JSON.parse(content) as EtlJobRecord;
          } catch {
            return null;
          }
        })
    );

    return jobs.filter((job): job is EtlJobRecord => Boolean(job)).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  try {
    return readdirSync(getEtlJobsDir())
      .filter((entry) => entry.endsWith('.json'))
      .sort()
      .reverse()
      .flatMap((entry) => {
        try {
          return [JSON.parse(readFileSync(join(getEtlJobsDir(), entry), 'utf8')) as EtlJobRecord];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function toJsonl(records: unknown[]): string {
  return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
}

export async function readDatasetRecords<T>(name: EtlDatasetName): Promise<T[]> {
  const artifactPath = `etl/datasets/${name}.jsonl`;
  const content = await readArtifact(artifactPath);
  if (!content) {
    return [];
  }

  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as T];
      } catch {
        return [];
      }
    });
}

export async function runEtl(source: EtlJobRecord['source']): Promise<EtlJobRecord> {
  const job: EtlJobRecord = {
    jobId: randomUUID(),
    source,
    status: 'running',
    startedAt: new Date().toISOString(),
    inputCount: 0,
    outputCount: 0,
    datasets: []
  };
  writeLocalJob(job);

  try {
    const inventories = listInventories();
    const runs = listSimulationRuns();
    const epochs = runs.flatMap((run) => listEpochLogs(run.runId).map((epoch) => ({ ...epoch, completedAt: run.completedAt })));
    const agentInstances = epochs.flatMap((epoch) =>
      epoch.agents.map((agent: (typeof epoch.agents)[number]) => ({
        runId: epoch.runId,
        scenarioId: epoch.scenarioId,
        protocolSlug: epoch.protocolSlug,
        epoch: epoch.epoch,
        ...agent
      }))
    );
    const session = await loadLatestPublishedCliSession();
    const [rektIncidents, soloditFindings] = await Promise.all([fetchRekt2026Incidents(), fetchSoloditFindings()]);
    const moduleChecks = build0GModuleChecks({
      blobConfigured: env.blobConfigured,
      vectorDatabaseConfigured: Boolean(env.databaseUrl),
      rpcUrl: session?.rpcUrl,
      generatedAt: new Date().toISOString()
    });

    const datasets: Array<{ name: EtlDatasetName; records: unknown[] }> = [
      { name: 'protocols', records: inventories },
      { name: 'simulations', records: runs },
      { name: 'epochs', records: epochs },
      { name: 'agent-instances', records: agentInstances },
      { name: 'rekt-incidents', records: rektIncidents },
      { name: 'solodit-findings', records: soloditFindings },
      { name: 'module-checks', records: moduleChecks }
    ];

    job.inputCount = inventories.length + runs.length + rektIncidents.length + soloditFindings.length + moduleChecks.length;
    for (const dataset of datasets) {
      const artifactPath = `etl/datasets/${dataset.name}.jsonl`;
      await writeArtifact(artifactPath, toJsonl(dataset.records));
      job.datasets.push({ name: dataset.name, path: artifactPath, recordCount: dataset.records.length });
      job.outputCount += dataset.records.length;
    }

    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    writeLocalJob(job);
    await writeArtifact(`etl/jobs/${job.jobId}.json`, `${JSON.stringify(job, null, 2)}\n`);
    return job;
  } catch (error) {
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error instanceof Error ? error.message : String(error);
    writeLocalJob(job);
    await writeArtifact(`etl/jobs/${job.jobId}.json`, `${JSON.stringify(job, null, 2)}\n`);
    throw error;
  }
}
