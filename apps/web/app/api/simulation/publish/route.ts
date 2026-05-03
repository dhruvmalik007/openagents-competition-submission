import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishSimulationRun } from '../../../../lib/server/published-simulations';

const simulationManifestSchema = z.object({
  event: z.literal('sim.run.completed'),
  runId: z.string(),
  scenarioId: z.string(),
  network: z.string(),
  episodes: z.number(),
  stepsPerEpisode: z.number(),
  protocolCount: z.number(),
  startedAt: z.string(),
  completedAt: z.string(),
  aggregate: z.object({
    attackerReward: z.number(),
    defenderReward: z.number(),
    judgeReward: z.number(),
    exploitSuccessRate: z.number(),
    averageTimeToDetectionSeconds: z.number(),
    averageReplayFidelity: z.number()
  }),
  protocols: z.array(z.object({
    protocolSlug: z.string(),
    protocolName: z.string(),
    incidentReference: z.string().optional(),
    contractCount: z.number(),
    resourceCount: z.number(),
    episodeCount: z.number()
  })),
  inferenceSummary: z.object({
    mode: z.enum(['heuristic', 'og-mock', 'og-sealed']),
    model: z.string(),
    totalInferenceCalls: z.number(),
    attestedResponses: z.number(),
    providers: z.array(z.string()),
    fallbackCount: z.number(),
    notes: z.array(z.string())
  }).optional(),
  latestAgentActions: z.array(z.object({
    role: z.enum(['attacker', 'ciso', 'defender', 'judge']),
    actionType: z.string(),
    intensity: z.number(),
    rationale: z.string().optional(),
    provider: z.string().optional(),
    confidence: z.number().optional(),
    signaturePresent: z.boolean(),
    remoteAttestationPresent: z.boolean(),
    uncertainty: z.string().optional(),
    timestamp: z.string()
  })).optional(),
  operatorContext: z.object({
    safeAddress: z.string(),
    signerAddress: z.string(),
    mode: z.enum(['browser', 'private-key', 'ledger', 'privy'])
  }).optional(),
  outputPaths: z.object({
    manifestPath: z.string(),
    epochLogPath: z.string(),
    openenvStepLogPath: z.string()
  })
});

const epochLogSchema = z.object({
  runId: z.string(),
  scenarioId: z.string(),
  protocolSlug: z.string(),
  protocolName: z.string(),
  epoch: z.number(),
  metrics: z.object({
    exploitSuccess: z.boolean(),
    fundsAtRiskUsd: z.number(),
    fundsRecoveredUsd: z.number(),
    timeToDetectionSeconds: z.number(),
    falsePositiveRate: z.number(),
    incidentReplayFidelity: z.number()
  }),
  agents: z.array(z.object({
    role: z.enum(['attacker', 'ciso', 'defender', 'judge']),
    actionCount: z.number(),
    reward: z.number(),
    observationsConsumed: z.number(),
    memoryWrites: z.number()
  }))
}).passthrough();

const publishPayloadSchema = z.object({
  manifest: simulationManifestSchema,
  epochLogs: z.array(epochLogSchema),
  openEnvStepLogs: z.array(z.object({
    event: z.enum(['openenv.reset', 'openenv.step', 'openenv.state']),
    timestamp: z.string()
  }).passthrough()).optional()
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json();
  const payload = publishPayloadSchema.parse(body);
  const published = await publishSimulationRun({
    manifest: payload.manifest,
    epochLogs: payload.epochLogs,
    openEnvStepLogs: payload.openEnvStepLogs
  });

  return NextResponse.json({
    runId: published.manifest.runId,
    publishedAt: published.publishedAt,
    inferenceSummary: published.manifest.inferenceSummary,
    latestAgentActions: published.manifest.latestAgentActions
  });
}