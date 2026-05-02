import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { Command } from 'commander';
import { galileoTestnet, OgInferenceClient } from '@aegis-arena/og';
import type { InferenceModel } from '@aegis-arena/og';
import { GRPOTrainer, MultiAgentPolicyCoordinator } from '@aegis-arena/rl-policy';
import type { PolicyCheckpoint, Trajectory } from '@aegis-arena/rl-policy';
import type { ProtocolInventory } from '@aegis-arena/etl';

type ProtocolSummary = {
  incidentReference: string;
  confidence: 'low' | 'medium' | 'high';
};

const commandDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(commandDir, '..', '..', '..', '..');
const inventoryDir = join(repoRoot, 'data', 'inventory', 'protocols');
const runsDir = join(repoRoot, 'runs', 'rl-sim');

type SimRunOptions = {
  scenario?: string;
  episodes: string;
  steps: string;
  slug?: string;
  inference?: 'heuristic' | 'og-mock' | 'og-sealed';
  model?: InferenceModel;
};

type SimTrainOptions = {
  scenario?: string;
  rounds: string;
  variants: string;
  episodes: string;
  steps: string;
  slug?: string;
  inference?: 'heuristic' | 'og-mock' | 'og-sealed';
  model?: InferenceModel;
};

type AgentRole = 'attacker' | 'ciso' | 'defender' | 'judge';

type OpenEnvObservation = {
  protocolSlug: string;
  episodeId: string;
  stepCount: number;
  currentAgent: AgentRole;
  legalActions: string[];
  riskScore: number;
  defenseScore: number;
  detectionConfidence: number;
  done: boolean;
};

type OpenEnvStepResult = {
  observation: OpenEnvObservation;
  reward: number;
  done: boolean;
  terminated: boolean;
  truncated: boolean;
  info: {
    runId: string;
    scenarioId: string;
    protocolSlug: string;
    epoch: number;
    episodeId: string;
    actingAgent: AgentRole;
    actionType: string;
    tracePath: string;
  };
};

type OpenEnvActionLog = {
  event: 'openenv.reset' | 'openenv.step' | 'openenv.state';
  timestamp: string;
  runId: string;
  scenarioId: string;
  protocolSlug: string;
  epoch: number;
  episodeId: string;
  stepCount: number;
  action?: {
    agent: AgentRole;
    actionType: string;
    target: string;
    intensity: number;
  };
  inference?: {
    mode: 'heuristic' | 'og-mock' | 'og-sealed';
    model: string;
    provider?: string;
    signaturePresent: boolean;
    remoteAttestationPresent: boolean;
    confidence?: number;
    uncertainty?: string;
  };
  result: OpenEnvStepResult;
};

type ProtocolEpisodeLog = {
  event: 'epoch.completed';
  runId: string;
  scenarioId: string;
  protocolSlug: string;
  protocolName: string;
  epoch: number;
  network: string;
  inference: {
    provider: '0g-testnet';
    mode: 'planner' | 'critic' | 'evaluator';
    modelHint: string;
  };
  agents: Array<{
    role: 'attacker' | 'ciso' | 'defender' | 'judge';
    actionCount: number;
    reward: number;
    observationsConsumed: number;
    memoryWrites: number;
  }>;
  metrics: {
    exploitSuccess: boolean;
    fundsAtRiskUsd: number;
    fundsRecoveredUsd: number;
    timeToDetectionSeconds: number;
    falsePositiveRate: number;
    incidentReplayFidelity: number;
  };
  artifacts: {
    tracePath: string;
    memorySnapshotPath: string;
    reportPath: string;
  };
};

type SimRunManifest = {
  event: 'sim.run.completed';
  runId: string;
  scenarioId: string;
  network: string;
  episodes: number;
  stepsPerEpisode: number;
  protocolCount: number;
  startedAt: string;
  completedAt: string;
  aggregate: {
    attackerReward: number;
    defenderReward: number;
    judgeReward: number;
    exploitSuccessRate: number;
    averageTimeToDetectionSeconds: number;
    averageReplayFidelity: number;
  };
  protocols: Array<{
    protocolSlug: string;
    protocolName: string;
    incidentReference?: string;
    contractCount: number;
    resourceCount: number;
    episodeCount: number;
  }>;
  outputPaths: {
    manifestPath: string;
    epochLogPath: string;
    openenvStepLogPath: string;
  };
};

function loadProtocolInventory(filePath: string): ProtocolInventory & { summary?: ProtocolSummary } {
  return JSON.parse(readFileSync(filePath, 'utf8')) as ProtocolInventory & { summary?: ProtocolSummary };
}

function discoverInventories(slug?: string): Array<ProtocolInventory & { summary?: ProtocolSummary }> {
  const files = readdirSync(inventoryDir)
    .filter((entry) => entry.endsWith('.json'))
    .filter((entry) => (slug ? entry === `${slug}.json` : true))
    .sort();

  if (files.length === 0) {
    throw new Error(slug ? `No protocol inventory found for slug "${slug}".` : 'No protocol inventories found.');
  }

  return files.map((entry) => loadProtocolInventory(join(inventoryDir, entry)));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Number(value.toFixed(3));
}

const AGENT_ORDER: AgentRole[] = ['attacker', 'ciso', 'defender', 'judge'];

const AGENT_ACTIONS: Record<AgentRole, string[]> = {
  attacker: ['scan-liquidity', 'craft-exploit', 'bridge-funds', 'execute-drain'],
  ciso: ['tighten-alert-policy', 'raise-severity', 'enable-guardrails', 'escalate-incident'],
  defender: ['pause-market', 'rate-limit-withdrawals', 'patch-oracle-checks', 'quarantine-asset'],
  judge: ['score-trajectory', 'audit-state-transition', 'compute-risk-delta', 'finalize-outcome']
};

function legalActionsFor(role: AgentRole): string[] {
  return AGENT_ACTIONS[role];
}

function buildObservation(input: {
  protocolSlug: string;
  episodeId: string;
  stepCount: number;
  currentAgent: AgentRole;
  riskScore: number;
  defenseScore: number;
  detectionConfidence: number;
  done: boolean;
}): OpenEnvObservation {
  return {
    protocolSlug: input.protocolSlug,
    episodeId: input.episodeId,
    stepCount: input.stepCount,
    currentAgent: input.currentAgent,
    legalActions: legalActionsFor(input.currentAgent),
    riskScore: round(input.riskScore),
    defenseScore: round(input.defenseScore),
    detectionConfidence: round(input.detectionConfidence),
    done: input.done
  };
}

async function resolveAction(input: {
  inferenceMode: 'heuristic' | 'og-mock' | 'og-sealed';
  inferenceClient?: OgInferenceClient;
  inferenceModel: InferenceModel;
  protocolSlug: string;
  episodeId: string;
  step: number;
  actingAgent: AgentRole;
  riskScore: number;
  defenseScore: number;
  detectionConfidence: number;
  lastAction?: { actor: AgentRole; actionType: string; intensity: number };
}): Promise<{
  actionType: string;
  intensity: number;
  inferenceMeta: OpenEnvActionLog['inference'];
}> {
  const legalActions = legalActionsFor(input.actingAgent);
  const heuristicActionType = legalActions[input.step % legalActions.length];
  const heuristicIntensity = round(clamp(0.35 + input.step * 0.07, 0.1, 1));

  if (input.inferenceMode === 'heuristic' || !input.inferenceClient) {
    return {
      actionType: heuristicActionType,
      intensity: heuristicIntensity,
      inferenceMeta: {
        mode: 'heuristic',
        model: 'n/a',
        signaturePresent: false,
        remoteAttestationPresent: false,
        confidence: 1,
        uncertainty: undefined
      }
    };
  }

  const inferenceResponse = await input.inferenceClient.generateAction(
    {
      protocolSlug: input.protocolSlug,
      episodeId: input.episodeId,
      stepCount: input.step,
      agentRole: input.actingAgent,
      riskScore: input.riskScore,
      defenseScore: input.defenseScore,
      detectionConfidence: input.detectionConfidence,
      legalActions,
      lastAction: input.lastAction
    },
    input.inferenceModel
  );

  const actionType = legalActions.includes(inferenceResponse.action.actionType)
    ? inferenceResponse.action.actionType
    : heuristicActionType;

  const intensity = round(clamp(inferenceResponse.action.intensity, 0.1, 1));

  return {
    actionType,
    intensity,
    inferenceMeta: {
      mode: input.inferenceMode,
      model: input.inferenceModel,
      provider: inferenceResponse.attestation.provider,
      signaturePresent: Boolean(inferenceResponse.attestation.signature),
      remoteAttestationPresent: Boolean(inferenceResponse.attestation.remoteAttestationReport),
      confidence: inferenceResponse.confidence,
      uncertainty: inferenceResponse.uncertainty
    }
  };
}

async function generateOpenEnvTrajectory(input: {
  protocol: ProtocolInventory & { summary?: ProtocolSummary };
  runId: string;
  scenarioId: string;
  epoch: number;
  maxSteps: number;
  tracePath: string;
  inferenceMode: 'heuristic' | 'og-mock' | 'og-sealed';
  inferenceModel: InferenceModel;
  inferenceClient?: OgInferenceClient;
}): Promise<{ actionLogs: OpenEnvActionLog[]; finalStepCount: number; detected: boolean; truncated: boolean }> {
  const { protocol, runId, scenarioId, epoch, maxSteps, tracePath, inferenceMode, inferenceModel, inferenceClient } = input;
  const episodeId = `${protocol.protocolSlug}-${String(epoch).padStart(4, '0')}`;
  const contractCount = protocol.contractAddresses.length;
  const verifiedCount = protocol.contractAddresses.filter((address) => address.verified).length;
  const highConfidenceCount = protocol.offchainResources.filter((resource) => resource.confidence === 'high').length;

  let riskScore = clamp(0.35 + contractCount * 0.04, 0, 1);
  let defenseScore = clamp(0.25 + verifiedCount * 0.05, 0, 1);
  let detectionConfidence = clamp(0.2 + highConfidenceCount * 0.08, 0, 1);
  let detected = false;
  let done = false;
  let truncated = false;

  const logs: OpenEnvActionLog[] = [];

  const initialObservation = buildObservation({
    protocolSlug: protocol.protocolSlug,
    episodeId,
    stepCount: 0,
    currentAgent: 'attacker',
    riskScore,
    defenseScore,
    detectionConfidence,
    done: false
  });

  logs.push({
    event: 'openenv.reset',
    timestamp: new Date().toISOString(),
    runId,
    scenarioId,
    protocolSlug: protocol.protocolSlug,
    epoch,
    episodeId,
    stepCount: 0,
    result: {
      observation: initialObservation,
      reward: 0,
      done: false,
      terminated: false,
      truncated: false,
      info: {
        runId,
        scenarioId,
        protocolSlug: protocol.protocolSlug,
        epoch,
        episodeId,
        actingAgent: 'attacker',
        actionType: 'reset',
        tracePath
      }
    }
  });

  let finalStepCount = 0;

  let lastAction: { actor: AgentRole; actionType: string; intensity: number } | undefined;

  for (let step = 1; step <= maxSteps; step += 1) {
    if (done) {
      break;
    }

    const actingAgent = AGENT_ORDER[(step - 1) % AGENT_ORDER.length];
    const { actionType, intensity, inferenceMeta } = await resolveAction({
      inferenceMode,
      inferenceClient,
      inferenceModel,
      protocolSlug: protocol.protocolSlug,
      episodeId,
      step,
      actingAgent,
      riskScore,
      defenseScore,
      detectionConfidence,
      lastAction
    });

    if (actingAgent === 'attacker') {
      riskScore = clamp(riskScore + 0.09 * intensity, 0, 1);
      detectionConfidence = clamp(detectionConfidence - 0.01, 0, 1);
    } else if (actingAgent === 'ciso') {
      defenseScore = clamp(defenseScore + 0.06 * intensity, 0, 1);
      detectionConfidence = clamp(detectionConfidence + 0.08 * intensity, 0, 1);
    } else if (actingAgent === 'defender') {
      riskScore = clamp(riskScore - 0.11 * intensity, 0, 1);
      defenseScore = clamp(defenseScore + 0.04 * intensity, 0, 1);
      detectionConfidence = clamp(detectionConfidence + 0.1 * intensity, 0, 1);
      if (riskScore > 0.55 && detectionConfidence > 0.55) {
        detected = true;
      }
    } else {
      detectionConfidence = clamp(detectionConfidence + 0.04, 0, 1);
      if (step >= 4 && detectionConfidence >= 0.62) {
        detected = true;
      }
    }

    const reward = actingAgent === 'attacker'
      ? round(clamp(riskScore - defenseScore * 0.5, 0, 1))
      : actingAgent === 'judge'
        ? round(clamp((defenseScore + (detected ? 0.2 : 0)) - riskScore * 0.3, 0, 1))
        : round(clamp(defenseScore + detectionConfidence * 0.25 - riskScore * 0.2, 0, 1));

    if (detected && actingAgent === 'judge') {
      done = true;
    } else if (step === maxSteps) {
      done = true;
      truncated = true;
    }

    const observation = buildObservation({
      protocolSlug: protocol.protocolSlug,
      episodeId,
      stepCount: step,
      currentAgent: AGENT_ORDER[step % AGENT_ORDER.length],
      riskScore,
      defenseScore,
      detectionConfidence,
      done
    });

    const result: OpenEnvStepResult = {
      observation,
      reward,
      done,
      terminated: done && !truncated,
      truncated,
      info: {
        runId,
        scenarioId,
        protocolSlug: protocol.protocolSlug,
        epoch,
        episodeId,
        actingAgent,
        actionType,
        tracePath
      }
    };

    logs.push({
      event: 'openenv.step',
      timestamp: new Date().toISOString(),
      runId,
      scenarioId,
      protocolSlug: protocol.protocolSlug,
      epoch,
      episodeId,
      stepCount: step,
      action: {
        agent: actingAgent,
        actionType,
        target: protocol.protocolSlug,
        intensity
      },
      inference: inferenceMeta,
      result
    });

    finalStepCount = step;
    lastAction = {
      actor: actingAgent,
      actionType,
      intensity
    };
  }

  const last = logs[logs.length - 1];
  logs.push({
    event: 'openenv.state',
    timestamp: new Date().toISOString(),
    runId,
    scenarioId,
    protocolSlug: protocol.protocolSlug,
    epoch,
    episodeId,
    stepCount: finalStepCount,
    result: {
      observation: last.result.observation,
      reward: 0,
      done: last.result.done,
      terminated: last.result.terminated,
      truncated: last.result.truncated,
      info: {
        runId,
        scenarioId,
        protocolSlug: protocol.protocolSlug,
        epoch,
        episodeId,
        actingAgent: 'judge',
        actionType: 'state',
        tracePath
      }
    }
  });

  return { actionLogs: logs, finalStepCount, detected, truncated };
}

async function simulateEpisode(
  protocol: ProtocolInventory & { summary?: ProtocolSummary },
  runId: string,
  scenarioId: string,
  epoch: number,
  maxSteps: number,
  tracePath: string,
  inferenceMode: 'heuristic' | 'og-mock' | 'og-sealed',
  inferenceModel: InferenceModel,
  inferenceClient?: OgInferenceClient
): Promise<{ episode: ProtocolEpisodeLog; openEnvLogs: OpenEnvActionLog[] }> {
  const contractCount = protocol.contractAddresses.length;
  const verifiedCount = protocol.contractAddresses.filter((address) => address.verified).length;
  const resourceCount = protocol.offchainResources.length;
  const highConfidenceCount = protocol.offchainResources.filter((resource) => resource.confidence === 'high').length;
  const confidenceWeight = protocol.contractAddresses.reduce((total, address) => total + (address.confidence === 'high' ? 1 : address.confidence === 'medium' ? 0.6 : 0.25), 0) +
    protocol.offchainResources.reduce((total, resource) => total + (resource.confidence === 'high' ? 1 : resource.confidence === 'medium' ? 0.6 : 0.25), 0);

  const { actionLogs, finalStepCount, detected, truncated } = await generateOpenEnvTrajectory({
    protocol,
    runId,
    scenarioId,
    epoch,
    maxSteps,
    tracePath,
    inferenceMode,
    inferenceModel,
    inferenceClient
  });

  const stepLogs = actionLogs.filter((entry) => entry.event === 'openenv.step');
  const agentRewards = {
    attacker: 0,
    ciso: 0,
    defender: 0,
    judge: 0
  } satisfies Record<AgentRole, number>;
  const agentCounts = {
    attacker: 0,
    ciso: 0,
    defender: 0,
    judge: 0
  } satisfies Record<AgentRole, number>;

  for (const log of stepLogs) {
    const role = log.action?.agent;
    if (!role) {
      continue;
    }
    agentRewards[role] += log.result.reward;
    agentCounts[role] += 1;
  }

  const attackerReward = round(agentCounts.attacker ? agentRewards.attacker / agentCounts.attacker : 0);
  const defenderReward = round(agentCounts.defender ? agentRewards.defender / agentCounts.defender : 0);
  const judgeReward = round(agentCounts.judge ? agentRewards.judge / agentCounts.judge : 0);
  const exploitSuccess = !detected && !truncated && contractCount >= 3;
  const fundsAtRiskUsd = Math.round((contractCount * 1_750_000 + resourceCount * 95_000 + 500_000) * 100) / 100;
  const fundsRecoveredUsd = Math.round(fundsAtRiskUsd * defenderReward * (exploitSuccess ? 0.42 : 0.68) * 100) / 100;
  const timeToDetectionSeconds = detected
    ? Math.round(clamp(finalStepCount * 45, 30, 360))
    : Math.round(clamp(300 - contractCount * 20 - highConfidenceCount * 18 + (exploitSuccess ? 35 : 0), 35, 360));
  const falsePositiveRate = round(clamp(0.18 - resourceCount * 0.01 + (protocol.summary?.confidence === 'high' ? -0.03 : protocol.summary?.confidence === 'medium' ? 0.02 : 0.05), 0.01, 0.35));
  const incidentReplayFidelity = round(clamp(0.55 + resourceCount * 0.03 + verifiedCount * 0.02 + (protocol.summary?.confidence === 'high' ? 0.12 : protocol.summary?.confidence === 'medium' ? 0.05 : 0), 0, 1));

  return {
    openEnvLogs: actionLogs,
    episode: {
    event: 'epoch.completed',
    runId,
    scenarioId,
    protocolSlug: protocol.protocolSlug,
    protocolName: protocol.protocolName,
    epoch,
    network: galileoTestnet.networkName,
    inference: {
      provider: '0g-testnet',
      mode: 'evaluator',
      modelHint: '0G-backed planner/critic/evaluator loop over protocol inventory'
    },
    agents: [
      {
        role: 'attacker',
        actionCount: Math.max(1, agentCounts.attacker),
        reward: attackerReward,
        observationsConsumed: stepLogs.length,
        memoryWrites: Math.max(1, Math.ceil(stepLogs.length / 3))
      },
      {
        role: 'ciso',
        actionCount: Math.max(1, agentCounts.ciso),
        reward: round(agentCounts.ciso ? agentRewards.ciso / agentCounts.ciso : 0),
        observationsConsumed: stepLogs.length,
        memoryWrites: 1
      },
      {
        role: 'defender',
        actionCount: Math.max(1, agentCounts.defender),
        reward: defenderReward,
        observationsConsumed: stepLogs.length,
        memoryWrites: Math.max(1, highConfidenceCount)
      },
      {
        role: 'judge',
        actionCount: Math.max(1, agentCounts.judge),
        reward: judgeReward,
        observationsConsumed: stepLogs.length,
        memoryWrites: 1
      }
    ],
    metrics: {
      exploitSuccess,
      fundsAtRiskUsd,
      fundsRecoveredUsd,
      timeToDetectionSeconds,
      falsePositiveRate,
      incidentReplayFidelity
    },
    artifacts: {
      tracePath,
      memorySnapshotPath: `runs/rl-sim/${runId}/epochs/${String(epoch).padStart(3, '0')}-${protocol.protocolSlug}.memory.json`,
      reportPath: `runs/rl-sim/${runId}/reports/${String(epoch).padStart(3, '0')}-${protocol.protocolSlug}.md`
    }
  }
  };
}

function aggregateLogs(logs: ProtocolEpisodeLog[]): SimRunManifest['aggregate'] {
  const totals = logs.reduce(
    (accumulator, log) => {
      accumulator.attackerReward += log.agents.find((agent) => agent.role === 'attacker')?.reward ?? 0;
      accumulator.defenderReward += log.agents.find((agent) => agent.role === 'defender')?.reward ?? 0;
      accumulator.judgeReward += log.agents.find((agent) => agent.role === 'judge')?.reward ?? 0;
      accumulator.exploitSuccessCount += log.metrics.exploitSuccess ? 1 : 0;
      accumulator.timeToDetectionSeconds += log.metrics.timeToDetectionSeconds;
      accumulator.replayFidelity += log.metrics.incidentReplayFidelity;
      return accumulator;
    },
    {
      attackerReward: 0,
      defenderReward: 0,
      judgeReward: 0,
      exploitSuccessCount: 0,
      timeToDetectionSeconds: 0,
      replayFidelity: 0
    }
  );

  return {
    attackerReward: round(totals.attackerReward / logs.length),
    defenderReward: round(totals.defenderReward / logs.length),
    judgeReward: round(totals.judgeReward / logs.length),
    exploitSuccessRate: round(totals.exploitSuccessCount / logs.length),
    averageTimeToDetectionSeconds: round(totals.timeToDetectionSeconds / logs.length),
    averageReplayFidelity: round(totals.replayFidelity / logs.length)
  };
}

async function handleSimRun(options: SimRunOptions): Promise<void> {
  const episodes = Number(options.episodes);
  const steps = Number(options.steps);
  const inferenceMode = options.inference ?? 'heuristic';
  const inferenceModel = options.model ?? 'llama-3.3-70b-instruct';

  if (!['heuristic', 'og-mock', 'og-sealed'].includes(inferenceMode)) {
    throw new Error('--inference must be one of: heuristic, og-mock, og-sealed');
  }
  if (!Number.isFinite(episodes) || episodes < 1) {
    throw new Error('--episodes must be a positive integer.');
  }
  if (!Number.isFinite(steps) || steps < 1) {
    throw new Error('--steps must be a positive integer.');
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const scenarioId = options.scenario ?? 'protocol-inventory';
  const inventories = discoverInventories(options.slug);
  const startedAt = new Date();
  const epochLogs: ProtocolEpisodeLog[] = [];
  const openEnvStepLogs: OpenEnvActionLog[] = [];
  const inferenceClient = inferenceMode === 'heuristic'
    ? undefined
    : new OgInferenceClient({
      rpcUrl: galileoTestnet.rpcUrl,
      inferenceServiceUrl: galileoTestnet.inference.computeNetworkUrl,
      attestationMode: inferenceMode === 'og-mock' ? 'mock' : 'sealed-inference',
      supportedModels: [...galileoTestnet.inference.supportedModels]
    });

  for (const protocol of inventories) {
    for (let index = 0; index < episodes; index += 1) {
      const epoch = epochLogs.length + 1;
      const tracePath = `runs/rl-sim/${runId}/epochs/${String(epoch).padStart(3, '0')}-${protocol.protocolSlug}.trace.jsonl`;
      const { episode, openEnvLogs } = await simulateEpisode(
        protocol,
        runId,
        scenarioId,
        epoch,
        steps,
        tracePath,
        inferenceMode,
        inferenceModel,
        inferenceClient
      );
      epochLogs.push(episode);
      openEnvStepLogs.push(...openEnvLogs);

      const absTracePath = join(repoRoot, episode.artifacts.tracePath);
      const absMemoryPath = join(repoRoot, episode.artifacts.memorySnapshotPath);
      const absReportPath = join(repoRoot, episode.artifacts.reportPath);

      mkdirSync(dirname(absTracePath), { recursive: true });
      mkdirSync(dirname(absMemoryPath), { recursive: true });
      mkdirSync(dirname(absReportPath), { recursive: true });

      const perEpisodeOpenEnvLogs = openEnvLogs.map((entry) => JSON.stringify(entry)).join('\n');
      writeFileSync(absTracePath, `${perEpisodeOpenEnvLogs}\n`, 'utf8');

      const latestState = openEnvLogs[openEnvLogs.length - 1]?.result.observation;
      writeFileSync(
        absMemoryPath,
        `${JSON.stringify(
          {
            runId,
            scenarioId,
            protocolSlug: protocol.protocolSlug,
            episodeId: latestState?.episodeId,
            finalState: latestState,
            trajectoryLength: openEnvLogs.filter((entry) => entry.event === 'openenv.step').length
          },
          null,
          2
        )}\n`,
        'utf8'
      );

      writeFileSync(
        absReportPath,
        `# ${protocol.protocolName} Episode ${epoch}\n\n- Scenario: ${scenarioId}\n- Run ID: ${runId}\n- Inference Mode: ${inferenceMode}\n- Inference Model: ${inferenceModel}\n- Steps: ${openEnvLogs.filter((entry) => entry.event === 'openenv.step').length}\n- Done: ${latestState?.done ?? false}\n- Risk Score: ${latestState?.riskScore ?? 0}\n- Defense Score: ${latestState?.defenseScore ?? 0}\n- Detection Confidence: ${latestState?.detectionConfidence ?? 0}\n`,
        'utf8'
      );
    }
  }

  const completedAt = new Date();
  const manifestPath = join(runsDir, runId, 'manifest.json');
  const epochLogPath = join(runsDir, runId, 'epoch-logs.jsonl');
  const openenvStepLogPath = join(runsDir, runId, 'openenv-step-results.jsonl');
  const aggregate = aggregateLogs(epochLogs);

  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(epochLogPath, `${epochLogs.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');
  writeFileSync(openenvStepLogPath, `${openEnvStepLogs.map((entry) => JSON.stringify(entry)).join('\n')}\n`, 'utf8');

  const manifest: SimRunManifest = {
    event: 'sim.run.completed',
    runId,
    scenarioId,
    network: galileoTestnet.networkName,
    episodes,
    stepsPerEpisode: steps,
    protocolCount: inventories.length,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    aggregate,
    protocols: inventories.map((protocol) => ({
      protocolSlug: protocol.protocolSlug,
      protocolName: protocol.protocolName,
      incidentReference: protocol.summary?.incidentReference,
      contractCount: protocol.contractAddresses.length,
      resourceCount: protocol.offchainResources.length,
      episodeCount: episodes
    })),
    outputPaths: {
      manifestPath,
      epochLogPath,
      openenvStepLogPath
    }
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify(manifest, null, 2));
  console.log(`Wrote epoch logs to ${epochLogPath}`);
}

function createBaseCheckpoint(role: AgentRole, model: string): PolicyCheckpoint {
  return {
    checkpointId: randomUUID(),
    agentRole: role,
    model,
    createdAt: new Date().toISOString(),
    parameters: {
      systemPromptVersion: 1,
      temperatureScaling: 1,
      riskTolerance: role === 'attacker' ? 0.7 : role === 'defender' ? 0.45 : 0.5,
      aggressivenessWeight: role === 'attacker' ? 0.8 : role === 'defender' ? 0.35 : 0.5
    },
    metrics: {
      episodesRun: 0,
      averageReward: 0,
      winRate: 0,
      lastUpdated: new Date().toISOString()
    }
  };
}

function buildTrajectoryFromLogs(input: {
  runId: string;
  protocolSlug: string;
  role: AgentRole;
  logs: OpenEnvActionLog[];
}): Trajectory {
  const stepLogs = input.logs.filter((entry) => entry.event === 'openenv.step');
  const roleSteps = stepLogs.filter((entry) => entry.action?.agent === input.role);
  const totalReward = roleSteps.reduce((sum, step) => sum + step.result.reward, 0);

  return {
    episodeId: input.logs[0]?.episodeId ?? `${input.protocolSlug}-unknown`,
    runId: input.runId,
    protocolSlug: input.protocolSlug,
    agentRole: input.role,
    steps: roleSteps.map((step) => ({
      stepCount: step.stepCount,
      observation: {
        riskScore: step.result.observation.riskScore,
        defenseScore: step.result.observation.defenseScore,
        detectionConfidence: step.result.observation.detectionConfidence
      },
      action: {
        actionType: step.action?.actionType ?? 'unknown',
        intensity: step.action?.intensity ?? 0
      },
      reward: step.result.reward,
      done: step.result.done
    })),
    totalReward: round(totalReward),
    episodeLength: stepLogs.length,
    terminatedEarly: Boolean(stepLogs.find((step) => step.result.terminated))
  };
}

async function handleSimTrain(options: SimTrainOptions): Promise<void> {
  const rounds = Number(options.rounds);
  const variants = Number(options.variants);
  const episodes = Number(options.episodes);
  const steps = Number(options.steps);
  const scenarioId = options.scenario ?? 'protocol-inventory';
  const inferenceMode = options.inference ?? 'heuristic';
  const inferenceModel = options.model ?? 'llama-3.3-70b-instruct';

  if (!Number.isFinite(rounds) || rounds < 1) {
    throw new Error('--rounds must be a positive integer.');
  }
  if (!Number.isFinite(variants) || variants < 2) {
    throw new Error('--variants must be >= 2 for GRPO.');
  }
  if (!Number.isFinite(episodes) || episodes < 1) {
    throw new Error('--episodes must be a positive integer.');
  }
  if (!Number.isFinite(steps) || steps < 1) {
    throw new Error('--steps must be a positive integer.');
  }

  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-train-${randomUUID().slice(0, 8)}`;
  const inventories = discoverInventories(options.slug);
  const trainingDir = join(runsDir, runId, 'training');
  mkdirSync(trainingDir, { recursive: true });

  const inferenceClient = inferenceMode === 'heuristic'
    ? undefined
    : new OgInferenceClient({
      rpcUrl: galileoTestnet.rpcUrl,
      inferenceServiceUrl: galileoTestnet.inference.computeNetworkUrl,
      attestationMode: inferenceMode === 'og-mock' ? 'mock' : 'sealed-inference',
      supportedModels: [...galileoTestnet.inference.supportedModels]
    });

  const coordinator = new MultiAgentPolicyCoordinator();
  const roles: AgentRole[] = ['attacker', 'ciso', 'defender', 'judge'];
  const roleCheckpointState = new Map<AgentRole, PolicyCheckpoint>();

  for (const role of roles) {
    coordinator.addTrainer(role, new GRPOTrainer({ agentRole: role, groupSize: variants, episodesPerVariant: episodes }));
    const checkpoint = createBaseCheckpoint(role, inferenceModel);
    roleCheckpointState.set(role, checkpoint);
    coordinator.saveCheckpoint(checkpoint);
  }

  const trainingLog: Array<Record<string, unknown>> = [];

  for (let roundIndex = 1; roundIndex <= rounds; roundIndex += 1) {
    for (const role of roles) {
      const trainer = coordinator.getTrainer(role);
      const baseCheckpoint = roleCheckpointState.get(role) ?? createBaseCheckpoint(role, inferenceModel);
      const variantRows: Array<{
        variantId: string;
        checkpointId: string;
        trajectories: Trajectory[];
        avgReward: number;
        winRate: number;
        rank: number;
      }> = [];

      for (let variantIndex = 0; variantIndex < variants; variantIndex += 1) {
        const candidateCheckpoint: PolicyCheckpoint = {
          ...baseCheckpoint,
          checkpointId: randomUUID(),
          createdAt: new Date().toISOString(),
          parameters: {
            ...baseCheckpoint.parameters,
            temperatureScaling: round(clamp(baseCheckpoint.parameters.temperatureScaling + (Math.random() - 0.5) * 0.2, 0.5, 1.8)),
            riskTolerance: round(clamp(baseCheckpoint.parameters.riskTolerance + (Math.random() - 0.5) * 0.15, 0.05, 0.95)),
            aggressivenessWeight: round(clamp((baseCheckpoint.parameters.aggressivenessWeight ?? 0.5) + (Math.random() - 0.5) * 0.15, 0.05, 0.95))
          }
        };

        const trajectories: Trajectory[] = [];
        let rewardSum = 0;
        let wins = 0;

        for (let episodeIndex = 0; episodeIndex < episodes; episodeIndex += 1) {
          for (const protocol of inventories) {
            const epoch = roundIndex * 10_000 + variantIndex * 100 + episodeIndex + 1;
            const tracePath = `runs/rl-sim/${runId}/training/r${String(roundIndex).padStart(2, '0')}-v${String(variantIndex + 1).padStart(2, '0')}-${protocol.protocolSlug}.trace.jsonl`;
            const { openEnvLogs, episode } = await simulateEpisode(
              protocol,
              runId,
              `${scenarioId}-train`,
              epoch,
              steps,
              tracePath,
              inferenceMode,
              inferenceModel,
              inferenceClient
            );

            const trajectory = buildTrajectoryFromLogs({
              runId,
              protocolSlug: protocol.protocolSlug,
              role,
              logs: openEnvLogs
            });

            trajectories.push(trajectory);
            trainer.addTrajectory(trajectory);
            rewardSum += trajectory.totalReward;
            if ((role === 'attacker' && episode.metrics.exploitSuccess) || (role !== 'attacker' && !episode.metrics.exploitSuccess)) {
              wins += 1;
            }
          }
        }

        const avgReward = trajectories.length ? round(rewardSum / trajectories.length) : 0;
        const winRate = trajectories.length ? round(wins / trajectories.length) : 0;
        variantRows.push({
          variantId: `${role}-r${roundIndex}-v${variantIndex + 1}`,
          checkpointId: candidateCheckpoint.checkpointId,
          trajectories,
          avgReward,
          winRate,
          rank: variantIndex + 1
        });
      }

      const batch = trainer.evaluateBatch({
        batchId: `${role}-round-${roundIndex}`,
        agentRole: role,
        variantCount: variants,
        episodesPerVariant: episodes,
        variants: variantRows,
        bestVariantId: variantRows[0]?.variantId ?? `${role}-none`,
        relativePerformance: {},
        timestamp: new Date().toISOString()
      });

      let winner = batch.variants[0];
      for (const variantEntry of batch.variants) {
        if (variantEntry.variantId === batch.bestVariantId) {
          winner = variantEntry;
          break;
        }
      }
      const nextCheckpoint: PolicyCheckpoint = {
        checkpointId: winner.checkpointId,
        agentRole: role,
        model: inferenceModel,
        createdAt: new Date().toISOString(),
        parameters: {
          ...baseCheckpoint.parameters,
          temperatureScaling: round(clamp(baseCheckpoint.parameters.temperatureScaling + 0.05, 0.5, 1.8)),
          riskTolerance: role === 'attacker'
            ? round(clamp(baseCheckpoint.parameters.riskTolerance + 0.03, 0.05, 0.95))
            : round(clamp(baseCheckpoint.parameters.riskTolerance - 0.02, 0.05, 0.95)),
          aggressivenessWeight: role === 'attacker'
            ? round(clamp((baseCheckpoint.parameters.aggressivenessWeight ?? 0.5) + 0.04, 0.05, 0.95))
            : round(clamp((baseCheckpoint.parameters.aggressivenessWeight ?? 0.5) - 0.03, 0.05, 0.95))
        },
        metrics: {
          episodesRun: winner.trajectories.length,
          averageReward: winner.avgReward,
          winRate: winner.winRate,
          lastUpdated: new Date().toISOString()
        }
      };

      roleCheckpointState.set(role, nextCheckpoint);
      coordinator.saveCheckpoint(nextCheckpoint);
      trainingLog.push({
        round: roundIndex,
        role,
        bestVariantId: batch.bestVariantId,
        averageReward: winner.avgReward,
        winRate: winner.winRate,
        checkpointId: nextCheckpoint.checkpointId,
        relativePerformance: batch.relativePerformance
      });
    }
  }

  const summaryPath = join(trainingDir, 'summary.json');
  const trainingSummary = {
    event: 'sim.train.completed',
    runId,
    scenarioId,
    rounds,
    variants,
    episodes,
    steps,
    protocolCount: inventories.length,
    inferenceMode,
    inferenceModel,
    roleSummary: coordinator.coordinateTraining(),
    checkpoints: Object.fromEntries(
      roles.map((role) => [role, roleCheckpointState.get(role)])
    ),
    trainingLog
  };

  writeFileSync(summaryPath, `${JSON.stringify(trainingSummary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(trainingSummary, null, 2));
}

function colorize(text: string, color: 'red' | 'green' | 'yellow' | 'blue' | 'cyan' | 'gray'): string {
  const colors: Record<string, string> = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
  };
  const reset = '\x1b[0m';
  return `${colors[color]}${text}${reset}`;
}

function formatReward(reward: number): string {
  if (reward >= 0.6) return colorize(`+${reward.toFixed(3)}`, 'green');
  if (reward >= 0.4) return colorize(`+${reward.toFixed(3)}`, 'yellow');
  return colorize(`+${reward.toFixed(3)}`, 'red');
}

type ReplayOptions = {
  run: string;
  protocol?: string;
};

async function handleSimReplay(options: ReplayOptions): Promise<void> {
  const { run: runId, protocol: protocolSlug } = options;
  const runPath = join(runsDir, runId);

  // Check if run exists
  try {
    readdirSync(runPath);
  } catch {
    console.error(`Run not found: ${runId}`);
    process.exit(1);
  }

  // Load manifest for context
  const manifestPath = join(runPath, 'manifest.json');
  const manifest: SimRunManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  // Load openenv-step-results.jsonl
  const openenvLogPath = join(runPath, 'openenv-step-results.jsonl');
  const lines = readFileSync(openenvLogPath, 'utf8').split('\n').filter((line) => line.trim());

  // Parse all logs
  const logs: OpenEnvActionLog[] = lines.map((line) => JSON.parse(line));

  // Group by protocol if specified
  const protocolLogs = protocolSlug ? logs.filter((log) => log.protocolSlug === protocolSlug) : logs;

  if (protocolLogs.length === 0) {
    console.error(`No trajectory found for protocol: ${protocolSlug || 'any'}`);
    process.exit(1);
  }

  // Group by episode
  const episodes = new Map<string, OpenEnvActionLog[]>();
  for (const log of protocolLogs) {
    const key = log.episodeId;
    if (!episodes.has(key)) {
      episodes.set(key, []);
    }
    episodes.get(key)!.push(log);
  }

  // Print each episode
  for (const [episodeId, episodeLogs] of episodes) {
    console.log(colorize(`\n╔══════════════════════════════════════════════════════════╗`, 'cyan'));
    console.log(colorize(`║  Episode: ${episodeId.padEnd(45)}║`, 'cyan'));
    console.log(colorize(`╚══════════════════════════════════════════════════════════╝`, 'cyan'));

    let resetLog: OpenEnvActionLog | undefined;
    const stepLogs: OpenEnvActionLog[] = [];
    let stateLog: OpenEnvActionLog | undefined;

    for (const log of episodeLogs) {
      if (log.event === 'openenv.reset') resetLog = log;
      else if (log.event === 'openenv.step') stepLogs.push(log);
      else if (log.event === 'openenv.state') stateLog = log;
    }

    // Print initial state
    if (resetLog) {
      const obs = resetLog.result.observation;
      console.log(colorize(`\n📊 INITIAL STATE (Reset)`, 'blue'));
      console.log(`   Risk Score:             ${obs.riskScore.toFixed(3)}`);
      console.log(`   Defense Score:          ${obs.defenseScore.toFixed(3)}`);
      console.log(`   Detection Confidence:   ${obs.detectionConfidence.toFixed(3)}`);
    }

    // Print each step
    console.log(colorize(`\n🎮 TURN-BY-TURN ACTIONS`, 'blue'));
    let cumulativeReward = 0;
    const agentRewards: Record<AgentRole, number> = {
      attacker: 0,
      ciso: 0,
      defender: 0,
      judge: 0
    };

    for (let i = 0; i < stepLogs.length; i += 1) {
      const log = stepLogs[i];
      const step = i + 1;
      const actingAgent = log.result.info.actingAgent;
      const agent = colorize(actingAgent.padEnd(8), getAgentColor(actingAgent));
      const action = log.result.info.actionType;
      const intensity = log.action?.intensity ?? 0;
      const reward = log.result.reward;
      const obs = log.result.observation;

      cumulativeReward += reward;
      agentRewards[actingAgent] += reward;

      console.log(`\n   Step ${step}: ${agent} | ${action.padEnd(25)} (intensity: ${intensity.toFixed(2)})`);
      if (log.inference) {
        const attestationBadge = log.inference.signaturePresent ? 'signed' : 'unsigned';
        console.log(
          `              ↳ Inference: ${log.inference.mode} | model=${log.inference.model} | provider=${log.inference.provider ?? 'n/a'} | ${attestationBadge}`
        );
        if (log.inference.uncertainty) {
          console.log(`              ↳ Note: ${log.inference.uncertainty}`);
        }
      }
      console.log(`              → Risk: ${obs.riskScore.toFixed(3)} | Defense: ${obs.defenseScore.toFixed(3)} | Detection: ${obs.detectionConfidence.toFixed(3)} | Reward: ${formatReward(reward)}`);

      if (log.result.done) {
        const reason = log.result.terminated ? 'TERMINATED' : 'TRUNCATED';
        console.log(colorize(`              ⚠️  Episode ${reason} at step ${step}`, 'yellow'));
        break;
      }
    }

    // Print final state
    if (stateLog) {
      const obs = stateLog.result.observation;
      console.log(colorize(`\n📈 FINAL STATE`, 'blue'));
      console.log(`   Risk Score:             ${obs.riskScore.toFixed(3)}`);
      console.log(`   Defense Score:          ${obs.defenseScore.toFixed(3)}`);
      console.log(`   Detection Confidence:   ${obs.detectionConfidence.toFixed(3)}`);
      console.log(`   Episode Complete:       ${obs.done ? 'Yes' : 'No'}`);
    }

    // Print reward summary
    console.log(colorize(`\n💰 REWARD SUMMARY`, 'blue'));
    console.log(`   Attacker:     ${formatReward(agentRewards.attacker)}`);
    console.log(`   CISO:         ${formatReward(agentRewards.ciso)}`);
    console.log(`   Defender:     ${formatReward(agentRewards.defender)}`);
    console.log(`   Judge:        ${formatReward(agentRewards.judge)}`);
    console.log(`   ${colorize('Total', 'cyan')}:         ${formatReward(cumulativeReward)}`);
  }

  console.log(colorize(`\n✅ Replay complete\n`, 'green'));
}

function getAgentColor(agent: AgentRole): 'red' | 'green' | 'yellow' | 'blue' {
  const colors: Record<AgentRole, 'red' | 'green' | 'yellow' | 'blue'> = {
    attacker: 'red',
    ciso: 'yellow',
    defender: 'green',
    judge: 'blue'
  };
  return colors[agent];
}

export function registerSimCommands(program: Command): void {
  const sim = program.command('sim').description('multi-agent RL simulation helpers');

  sim
    .command('run')
    .description('Run a deterministic multi-agent RL simulation over the bundled protocol inventories')
    .option('--scenario <scenarioId>', 'scenario identifier', 'data/protocol-inventory')
    .option('--episodes <count>', 'episodes per protocol', '1')
    .option('--steps <count>', 'max multi-step turns per episode (OpenEnv style)', '8')
    .option('--inference <mode>', 'action generation mode: heuristic | og-mock | og-sealed', 'heuristic')
    .option('--model <name>', 'inference model hint', 'llama-3.3-70b-instruct')
    .option('--slug <slug>', 'optional protocol slug to simulate; defaults to every bundled protocol')
    .action(async (options: SimRunOptions) => {
      await handleSimRun(options);
    });

  sim
    .command('train')
    .description('Run multi-agent policy training with dynamic GRPO variants')
    .option('--scenario <scenarioId>', 'scenario identifier', 'data/protocol-inventory')
    .option('--rounds <count>', 'number of GRPO rounds', '2')
    .option('--variants <count>', 'policy variants per round', '3')
    .option('--episodes <count>', 'episodes per variant', '1')
    .option('--steps <count>', 'max steps per episode', '8')
    .option('--inference <mode>', 'action generation mode: heuristic | og-mock | og-sealed', 'heuristic')
    .option('--model <name>', 'inference model hint', 'llama-3.3-70b-instruct')
    .option('--slug <slug>', 'optional protocol slug to train on; defaults to every bundled protocol')
    .action(async (options: SimTrainOptions) => {
      await handleSimTrain(options);
    });

  sim
    .command('replay')
    .description('Pretty-print a recorded episode trajectory in human-readable format')
    .option('--run <runId>', 'run ID to replay', '')
    .option('--protocol <slug>', 'optional protocol slug to filter trajectory')
    .action(async (options: ReplayOptions) => {
      if (!options.run) {
        console.error('Error: --run <runId> is required');
        process.exit(1);
      }
      await handleSimReplay(options);
    });
}
