import type { DashboardSnapshot, DashboardTimePoint, InventoryRecord, ProtocolDashboardRecord, SimulationRunRecord } from '../types';
import { loadLatestPublishedCliSession } from './auth';
import { listEpochLogs, listInventories, listSimulationRuns } from './local-repository';
import { env } from './env';
import { listEtlJobs } from './etl';
import { countVectorDocuments } from './vector';

function buildSimulationRunRecords() {
  return listSimulationRuns().map((run) => ({
    ...run,
    agentInstanceCount: run.protocols.reduce((sum: number, protocol: SimulationRunRecord['protocols'][number]) => sum + protocol.episodeCount * 4, 0)
  } satisfies SimulationRunRecord));
}

function buildProtocolRecords(runs: SimulationRunRecord[]): ProtocolDashboardRecord[] {
  const inventories = listInventories();
  const bySlug = new Map<string, ProtocolDashboardRecord>();

  for (const inventory of inventories) {
    const verifiedContracts = inventory.contractAddresses.filter((entry: InventoryRecord['contractAddresses'][number]) => entry.verified).length;
    bySlug.set(inventory.protocolSlug, {
      protocolSlug: inventory.protocolSlug,
      protocolName: inventory.protocolName,
      incidentReference: inventory.summary?.incidentReference,
      contractCount: inventory.contractAddresses.length,
      verifiedContracts,
      resourceCount: inventory.offchainResources.length,
      timesSimulated: 0,
      averageExploitSuccessRate: 0,
      averageReplayFidelity: 0,
      latestRunAt: undefined
    });
  }

  const protocolMetrics = new Map<string, { count: number; exploitSuccessTotal: number; fidelityTotal: number; latestRunAt?: string }>();
  for (const run of runs) {
    const epochLogs = listEpochLogs(run.runId);
    for (const epoch of epochLogs) {
      const current = protocolMetrics.get(epoch.protocolSlug) ?? { count: 0, exploitSuccessTotal: 0, fidelityTotal: 0, latestRunAt: undefined };
      current.count += 1;
      current.exploitSuccessTotal += epoch.metrics.exploitSuccess ? 1 : 0;
      current.fidelityTotal += epoch.metrics.incidentReplayFidelity;
      current.latestRunAt = run.completedAt;
      protocolMetrics.set(epoch.protocolSlug, current);
    }
  }

  for (const [slug, metrics] of protocolMetrics.entries()) {
    const record = bySlug.get(slug);
    if (!record) continue;
    record.timesSimulated = metrics.count;
    record.averageExploitSuccessRate = metrics.count ? metrics.exploitSuccessTotal / metrics.count : 0;
    record.averageReplayFidelity = metrics.count ? metrics.fidelityTotal / metrics.count : 0;
    record.latestRunAt = metrics.latestRunAt;
  }

  return Array.from(bySlug.values()).sort((a, b) => b.timesSimulated - a.timesSimulated || a.protocolName.localeCompare(b.protocolName));
}

function buildTimeSeries(runs: SimulationRunRecord[]): DashboardTimePoint[] {
  const byBucket = new Map<string, DashboardTimePoint & { protocolSet: Set<string> }>();

  for (const run of runs) {
    const bucket = run.completedAt.slice(0, 10);
    const point = byBucket.get(bucket) ?? {
      bucket,
      runs: 0,
      agentInstances: 0,
      uniqueProtocols: 0,
      protocolSet: new Set<string>()
    };
    point.runs += 1;
    point.agentInstances += run.agentInstanceCount;
    for (const protocol of run.protocols) {
      point.protocolSet.add(protocol.protocolSlug);
    }
    point.uniqueProtocols = point.protocolSet.size;
    byBucket.set(bucket, point);
  }

  return Array.from(byBucket.values())
    .sort((a, b) => a.bucket.localeCompare(b.bucket))
    .map(({ protocolSet: _protocolSet, ...point }) => point);
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const runs = buildSimulationRunRecords();
  const protocols = buildProtocolRecords(runs);
  const timeseries = buildTimeSeries(runs);
  const session = await loadLatestPublishedCliSession();
  const inventories = listInventories();
  const vectorDocuments = await countVectorDocuments();
  const etlJobs = await listEtlJobs();

  const roleTotals = [
    { role: 'attacker' as const, reward: 0, actionCount: 0, memoryWrites: 0 },
    { role: 'ciso' as const, reward: 0, actionCount: 0, memoryWrites: 0 },
    { role: 'defender' as const, reward: 0, actionCount: 0, memoryWrites: 0 },
    { role: 'judge' as const, reward: 0, actionCount: 0, memoryWrites: 0 }
  ];
  const roleMap = new Map(roleTotals.map((entry) => [entry.role, entry]));

  for (const run of runs) {
    for (const epoch of listEpochLogs(run.runId)) {
      for (const agent of epoch.agents) {
        const current = roleMap.get(agent.role);
        if (!current) continue;
        current.reward += agent.reward;
        current.actionCount += agent.actionCount;
        current.memoryWrites += agent.memoryWrites;
      }
    }
  }

  const latestRun = runs[0] ?? null;
  const snapshot: DashboardSnapshot = {
    overview: {
      generatedAt: new Date().toISOString(),
      session,
      totals: {
        inventories: inventories.length,
        redTeamedProtocols: protocols.filter((protocol) => protocol.timesSimulated > 0).length,
        simulationRuns: runs.length,
        simulationEpisodes: runs.reduce((sum: number, run) => sum + run.protocols.reduce((inner: number, protocol: SimulationRunRecord['protocols'][number]) => inner + protocol.episodeCount, 0), 0),
        agentInstances: runs.reduce((sum, run) => sum + run.agentInstanceCount, 0),
        vectorDocuments,
        etlJobs: etlJobs.length
      },
      agentRoleTotals: roleTotals,
      latestRun,
      pipelineHealth: {
        localRepositoryReadable: inventories.length > 0,
        blobConfigured: env.blobConfigured,
        vectorDbConfigured: Boolean(env.databaseUrl),
        vectorDimension: env.vectorDimension
      }
    },
    protocols,
    runs,
    timeseries
  };

  return snapshot;
}
