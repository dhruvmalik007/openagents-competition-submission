import { randomUUID } from 'node:crypto';
import type { ServiceWithDetail, ZGComputeNetworkBroker } from '@0gfoundation/0g-compute-ts-sdk';
import { JsonRpcProvider, Wallet } from 'ethers';
import { galileoTestnet, resolveOgRuntimeConfig } from './sdk.js';
import type { AttestationMode, OgRuntimeConfig } from './sdk.js';

type ComputeSdkModule = typeof import('@0gfoundation/0g-compute-ts-sdk');

let computeSdkPromise: Promise<ComputeSdkModule> | null = null;

async function loadComputeSdk(): Promise<ComputeSdkModule> {
  computeSdkPromise ??= import('@0gfoundation/0g-compute-ts-sdk');
  return computeSdkPromise;
}

export type AgentRole = 'attacker' | 'ciso' | 'defender' | 'judge';

export type InferenceModel = 'llama-3.3-70b-instruct' | 'deepseek-r1-70b' | 'glm-5-reasoning' | (string & {});

/**
 * Agent context passed to inference service
 * Describes the current game state and agent's perspective
 */
export type AgentObservation = {
  protocolSlug: string;
  episodeId: string;
  stepCount: number;
  agentRole: AgentRole;
  
  // Environmental state
  riskScore: number;
  defenseScore: number;
  detectionConfidence: number;
  
  // Legal actions available to this agent
  legalActions: string[];
  
  // Recent history for context
  lastAction?: {
    actor: AgentRole;
    actionType: string;
    intensity: number;
  };
  
  // Role-specific context (optional fields per role)
  detectedAnomalies?: string[];       // Defender
  quarantinedAssets?: string[];       // Defender
  activePolicies?: string[];          // Defender
  
  vulnerabilities?: string[];         // Attacker
  liquidityPools?: number;            // Attacker
  bridgeRoutes?: number;              // Attacker
  
  alertLevel?: 'low' | 'medium' | 'high' | 'critical'; // CISO
  escalationPath?: string[];          // CISO
  stakeholders?: string[];            // CISO
  
  detectedBreach?: boolean;           // Judge
  defenseEffectiveness?: number;      // Judge
  incidentTimeline?: Array<{ step: number; severity: number }>; // Judge
};

/**
 * Inference request sent to 0G Compute Network
 * Contains agent context and request for action generation
 */
export type InferenceRequest = {
  requestId: string;
  model: InferenceModel;
  agent: {
    role: AgentRole;
    observation: AgentObservation;
  };
  
  // System prompt tailored to agent role
  systemPrompt: string;
  
  // User message requesting action
  userMessage: string;
  
  // Attestation requirements
  attestationMode: AttestationMode;
  
  // Verification constraints
  constraints: {
    actionMustBeFromLegalSet: boolean;
    intensityMustBeInRange: [number, number];
    responseTimeout: number; // milliseconds
  };
};

/**
 * Inference response from 0G Compute Network
 * Includes generated action and cryptographic proof
 */
export type InferenceResponse = {
  requestId: string;
  agentRole: AgentRole;
  
  // Generated action
  action: {
    actionType: string;
    intensity: number;
    rationale: string;
  };
  
  // Attestation proof
  attestation: {
    mode: AttestationMode;
    signature?: string;           // Cryptographic signature from TEE
    remoteAttestationReport?: string; // RA report for verification
    provider: string;              // Compute provider public key
    timestamp: string;             // ISO timestamp
  };
  
  // Confidence and uncertainty
  confidence: number; // 0-1 scale
  uncertainty?: string;
};

/**
 * Policy checkpoint for agent role
 * Used for training and variant selection
 */
export type PolicyCheckpoint = {
  checkpointId: string;
  agentRole: AgentRole;
  model: InferenceModel;
  createdAt: string;
  
  // Policy weights/parameters
  parameters: {
    systemPromptVersion: number;
    temperatureScaling: number;
    riskTolerance: number;
    aggressivenessWeight: number;
  };
  
  // Performance metrics
  metrics: {
    episodesRun: number;
    averageReward: number;
    winRate: number;
    lastUpdated: string;
  };
};

/**
 * 0G Compute Network client
 * Orchestrates verifiable inference calls through sealed inference
 */
export class OgInferenceClient {
  private readonly rpcUrl: string;
  private readonly attestationMode: AttestationMode;
  private readonly models: InferenceModel[];
  private readonly privateKey?: string;
  private readonly providerAddress?: string;
  private readonly inferenceApiKey?: string;
  private readonly inferenceServiceUrl?: string;
  private readonly contractOverrides?: OgRuntimeConfig['contractOverrides'];
  private readonly gasPrice?: number;
  private readonly maxGasPrice?: number;
  private readonly step?: number;
  private readonly allowMockFallback: boolean;
  private brokerPromise: Promise<ZGComputeNetworkBroker> | null = null;
  private providerCache: Map<string, string> = new Map();

  constructor(config: {
    rpcUrl?: string;
    attestationMode?: AttestationMode;
    supportedModels?: InferenceModel[];
    privateKey?: string;
    providerAddress?: string;
    inferenceApiKey?: string;
    inferenceServiceUrl?: string;
    contractOverrides?: OgRuntimeConfig['contractOverrides'];
    gasPrice?: number;
    maxGasPrice?: number;
    step?: number;
    allowMockFallback?: boolean;
  }) {
    const runtime = resolveOgRuntimeConfig({
      rpcUrl: config.rpcUrl,
      privateKey: config.privateKey,
      providerAddress: config.providerAddress,
      inferenceApiKey: config.inferenceApiKey,
      inferenceServiceUrl: config.inferenceServiceUrl,
      contractOverrides: config.contractOverrides,
      gasPrice: config.gasPrice,
      maxGasPrice: config.maxGasPrice,
      step: config.step
    });

    this.rpcUrl = runtime.rpcUrl;
    this.attestationMode = config.attestationMode ?? 'sealed-inference';
    this.models = config.supportedModels ?? [
      'llama-3.3-70b-instruct',
      'deepseek-r1-70b',
      'glm-5-reasoning'
    ];
    this.privateKey = runtime.privateKey;
    this.providerAddress = runtime.providerAddress;
    this.inferenceApiKey = runtime.inferenceApiKey;
    this.inferenceServiceUrl = runtime.inferenceServiceUrl;
    this.contractOverrides = runtime.contractOverrides;
    this.gasPrice = runtime.gasPrice;
    this.maxGasPrice = runtime.maxGasPrice;
    this.step = runtime.step;
    this.allowMockFallback = config.allowMockFallback ?? this.attestationMode === 'mock';
  }

  /**
   * Generate an action for an agent using 0G inference
   * This is the main entry point for calling verifiable AI
   */
  async generateAction(
    observation: AgentObservation,
    model: InferenceModel = 'llama-3.3-70b-instruct'
  ): Promise<InferenceResponse> {
    if (!this.models.includes(model)) {
      throw new Error(`Model ${model} not supported. Available: ${this.models.join(', ')}`);
    }

    const systemPrompt = buildSystemPrompt(observation.agentRole);
    const userMessage = buildUserMessage(observation);

    const request: InferenceRequest = {
      requestId: randomUUID(),
      model,
      agent: {
        role: observation.agentRole,
        observation
      },
      systemPrompt,
      userMessage,
      attestationMode: this.attestationMode,
      constraints: {
        actionMustBeFromLegalSet: true,
        intensityMustBeInRange: [0.1, 1.0],
        responseTimeout: 30000
      }
    };

    // In mock mode, generate deterministic response for testing
    if (this.attestationMode === 'mock') {
      return this.generateMockResponse(request);
    }

    // Call 0G Compute Network (would be actual API call in production)
    return this.callOgComputeNetwork(request);
  }

  /**
   * Call 0G Compute Network for sealed inference
   * Returns cryptographically signed response with attestation proof
   */
  private async callOgComputeNetwork(request: InferenceRequest): Promise<InferenceResponse> {
    try {
      const completion = await this.requestChatCompletion(request);
      const parsedAction = parseActionPayload(completion.content, request.agent.observation.legalActions);

      return {
        requestId: request.requestId,
        agentRole: request.agent.role,
        action: {
          actionType: parsedAction.actionType,
          intensity: parsedAction.intensity,
          rationale: parsedAction.rationale
        },
        attestation: {
          mode: this.attestationMode,
          signature: completion.signature,
          remoteAttestationReport: completion.remoteAttestationReport,
          provider: completion.provider,
          timestamp: completion.timestamp
        },
        confidence: completion.confidence,
        uncertainty: completion.uncertainty
      };
    } catch (error) {
      if (!this.allowMockFallback) {
        throw new Error(`0G inference failed without mock fallback: ${error instanceof Error ? error.message : String(error)}`);
      }

      const fallback = this.generateMockResponse(request);
      return {
        ...fallback,
        attestation: {
          ...fallback.attestation,
          provider: 'fallback-mock.0g.ai'
        },
        uncertainty: `Fallback to mock inference: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Generate mock response for testing (deterministic based on role)
   */
  private generateMockResponse(request: InferenceRequest): InferenceResponse {
    const { agent, requestId } = request;
    const legalAction = agent.observation.legalActions[0] ?? 'default-action';
    const intensity = 0.35 + (agent.observation.stepCount * 0.07);

    return {
      requestId,
      agentRole: agent.role,
      action: {
        actionType: legalAction,
        intensity: Math.min(intensity, 1.0),
        rationale: buildActionRationale(agent.role, agent.observation, legalAction)
      },
      attestation: {
        mode: this.attestationMode,
        signature: `sig_${randomUUID()}`,
        provider: 'mock-provider.0g.ai',
        timestamp: new Date().toISOString()
      },
      confidence: 0.85
    };
  }

  private async requestChatCompletion(request: InferenceRequest): Promise<{
    content: string;
    provider: string;
    signature?: string;
    remoteAttestationReport?: string;
    timestamp: string;
    confidence: number;
    uncertainty?: string;
  }> {
    if (this.inferenceServiceUrl) {
      return this.requestDirectCompletion(request, this.inferenceServiceUrl, this.inferenceApiKey);
    }

    if (!this.privateKey) {
      const providers = await this.listSuggestedProviders(request.model);
      const providerHint = providers[0]?.provider;
      throw new Error(
        providerHint
          ? `Missing wallet credentials for broker-authenticated inference. Set AEGIS_OG_PRIVATE_KEY or provide inferenceServiceUrl. Suggested provider: ${providerHint}`
          : 'Missing wallet credentials for broker-authenticated inference. Set AEGIS_OG_PRIVATE_KEY or provide inferenceServiceUrl.'
      );
    }

    const broker = await this.getBroker();
    const providerAddress = await this.resolveProviderAddressForModel(broker, request.model);
    const metadata = await broker.inference.getServiceMetadata(providerAddress);

    try {
      await broker.inference.acknowledgeProviderSigner(providerAddress);
    } catch {
      // The provider may already be acknowledged or the connected signer may not need to perform this step.
    }

    const headers = await broker.inference.getRequestHeaders(providerAddress, JSON.stringify(buildMessages(request)));
    return this.requestDirectCompletion(
      request,
      metadata.endpoint,
      undefined,
      normalizeRequestHeaders(headers),
      providerAddress,
      metadata.model
    );
  }

  private async requestDirectCompletion(
    request: InferenceRequest,
    serviceUrl: string,
    apiKey?: string,
    additionalHeaders: Record<string, string> = {},
    provider?: string,
    resolvedModel?: string
  ): Promise<{
    content: string;
    provider: string;
    signature?: string;
    remoteAttestationReport?: string;
    timestamp: string;
    confidence: number;
    uncertainty?: string;
  }> {
    const endpoint = `${serviceUrl.replace(/\/$/, '')}/chat/completions`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...additionalHeaders
      },
      body: JSON.stringify({
        model: resolvedModel ?? request.model,
        messages: buildMessages(request),
        temperature: 0.2,
        response_format: {
          type: 'json_object'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`0G inference request failed with HTTP ${response.status}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
      model?: string;
      usage?: { total_tokens?: number };
    };
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('0G inference response did not include a completion payload.');
    }

    const attestationHeaders = readAttestationHeaders(response.headers);
    return {
      content,
      provider: provider ?? serviceUrl,
      signature: attestationHeaders.signature,
      remoteAttestationReport: attestationHeaders.remoteAttestationReport,
      timestamp: new Date().toISOString(),
      confidence: payload.usage?.total_tokens ? 0.84 : 0.78,
      uncertainty:
        attestationHeaders.signature || attestationHeaders.remoteAttestationReport
          ? undefined
          : 'Inference completed without surfaced attestation headers; inspect provider metadata and TEE artifacts separately.'
    };
  }

  private async getBroker(): Promise<ZGComputeNetworkBroker> {
    if (!this.privateKey) {
      throw new Error('Missing private key for authenticated 0G compute broker access.');
    }

    if (!this.brokerPromise) {
      const provider = new JsonRpcProvider(this.rpcUrl);
      const wallet = new Wallet(this.privateKey, provider);
      const { createZGComputeNetworkBroker } = await loadComputeSdk();
      this.brokerPromise = createZGComputeNetworkBroker(
        wallet as never,
        this.contractOverrides?.ledgerCA,
        this.contractOverrides?.inferenceCA,
        this.contractOverrides?.fineTuningCA,
        this.gasPrice,
        this.maxGasPrice,
        this.step
      );
    }

    return this.brokerPromise;
  }

  private async resolveProviderAddressForModel(broker: ZGComputeNetworkBroker, model: InferenceModel): Promise<string> {
    if (this.providerAddress) {
      return this.providerAddress;
    }

    const cacheKey = String(model);
    const cached = this.providerCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const services = await broker.inference.listServiceWithDetail(0, 50, false);
    const matchedService = services.find((service) => matchesRequestedModel(model, service)) ?? services[0];

    if (!matchedService) {
      throw new Error(`No 0G inference providers were returned for model ${model}.`);
    }

    this.providerCache.set(cacheKey, matchedService.provider);
    return matchedService.provider;
  }

  private async listSuggestedProviders(model: InferenceModel): Promise<ServiceWithDetail[]> {
    const { createZGComputeNetworkReadOnlyBroker } = await loadComputeSdk();
    const broker = await createZGComputeNetworkReadOnlyBroker(this.rpcUrl, galileoTestnet.chainId);
    const services = await broker.inference.listServiceWithDetail(0, 20, false);
    return services.filter((service) => matchesRequestedModel(model, service));
  }
}

/**
 * Build system prompt for agent role
 * Defines the agent's objectives and constraints
 */
function buildSystemPrompt(role: AgentRole): string {
  const prompts: Record<AgentRole, string> = {
    attacker: `You are an intelligent adversary in a security scenario. Your role is to identify vulnerabilities and execute exploits against a DeFi protocol. 
    
    Your objectives:
    - Identify and exploit liquidity pools and bridge vulnerabilities
    - Drain funds by executing precision attacks on smart contracts
    - Evade detection by timing attacks strategically
    
    Constraints:
    - Only use actions from the provided legal action set
    - Provide clear rationale for each action
    - Consider the likelihood of detection vs potential reward
    
    Output: JSON with fields: actionType (string), intensity (0-1), rationale (string)`,

    defender: `You are a security engineer protecting a DeFi protocol. Your role is to defend against attacks and contain breaches.
    
    Your objectives:
    - Detect and stop ongoing attacks
    - Quarantine compromised assets and market segments
    - Implement emergency controls and circuit breakers
    - Minimize loss while maximizing detection confidence
    
    Constraints:
    - Only use actions from the provided legal action set
    - Balance aggressiveness with false positive rates
    - Consider systemic impact of defensive measures
    
    Output: JSON with fields: actionType (string), intensity (0-1), rationale (string)`,

    ciso: `You are a Chief Information Security Officer coordinating an incident response. Your role is to escalate alerts and drive organizational response.
    
    Your objectives:
    - Monitor risk indicators and escalate threats
    - Coordinate between technical and organizational teams
    - Enforce security policies and tighten controls
    - Maintain stakeholder communication
    
    Constraints:
    - Only use actions from the provided legal action set
    - Consider incident severity and escalation paths
    - Balance urgency with false alarm risk
    
    Output: JSON with fields: actionType (string), intensity (0-1), rationale (string)`,

    judge: `You are an objective judge evaluating the security incident and defense effectiveness.
    
    Your objectives:
    - Score the trajectory of attack vs defense
    - Determine if the incident was detected and contained
    - Evaluate the quality of defensive measures
    - Provide impartial outcome assessment
    
    Constraints:
    - Only use actions from the provided legal action set
    - Base scoring on observable evidence, not speculation
    - Consider both short-term and long-term security implications
    
    Output: JSON with fields: actionType (string), intensity (0-1), rationale (string)`
  };

  return prompts[role];
}

/**
 * Build user message for agent
 */
function buildUserMessage(observation: AgentObservation): string {
  return `
Analyze this security scenario and recommend your next action.

Current State:
- Protocol: ${observation.protocolSlug}
- Step: ${observation.stepCount}
- Risk Score: ${observation.riskScore.toFixed(3)}
- Defense Score: ${observation.defenseScore.toFixed(3)}
- Detection Confidence: ${observation.detectionConfidence.toFixed(3)}

Your Role: ${observation.agentRole}
Legal Actions: ${observation.legalActions.join(', ')}

${observation.lastAction ? `Last Action: ${observation.lastAction.actor} used ${observation.lastAction.actionType} (intensity: ${observation.lastAction.intensity.toFixed(2)})` : 'No prior actions in this round.'}

Based on the scenario above, recommend your next action. Consider the risk/reward tradeoffs and the actions available to you.
  `.trim();
}

/**
 * Build rationale for chosen action
 */
function buildActionRationale(
  role: AgentRole,
  observation: AgentObservation,
  action: string
): string {
  const rationales: Record<AgentRole, string> = {
    attacker: `Executing ${action} to increase risk score from ${observation.riskScore.toFixed(3)} and exploit current defense gaps.`,
    defender: `Deploying ${action} to reduce risk and increase detection confidence from ${observation.detectionConfidence.toFixed(3)}.`,
    ciso: `Coordinating ${action} to raise overall security posture and incident response effectiveness.`,
    judge: `Evaluating ${action} as part of objective incident trajectory assessment and defense quality scoring.`
  };

  return rationales[role];
}

/**
 * Policy manager for agent role
 * Tracks checkpoints and supports variant selection
 */
export class OgPolicyManager {
  private checkpoints: Map<string, PolicyCheckpoint> = new Map();

  saveCheckpoint(checkpoint: PolicyCheckpoint): void {
    this.checkpoints.set(checkpoint.checkpointId, checkpoint);
  }

  getCheckpoint(id: string): PolicyCheckpoint | undefined {
    return this.checkpoints.get(id);
  }

  getCheckpointsForRole(role: AgentRole): PolicyCheckpoint[] {
    return Array.from(this.checkpoints.values()).filter((cp) => cp.agentRole === role);
  }

  rankCheckpoints(role: AgentRole): PolicyCheckpoint[] {
    return this.getCheckpointsForRole(role).sort(
      (a, b) => b.metrics.averageReward - a.metrics.averageReward
    );
  }

  createVariant(baseCheckpoint: PolicyCheckpoint, modifications: Partial<PolicyCheckpoint['parameters']>): PolicyCheckpoint {
    return {
      checkpointId: randomUUID(),
      agentRole: baseCheckpoint.agentRole,
      model: baseCheckpoint.model,
      createdAt: new Date().toISOString(),
      parameters: {
        ...baseCheckpoint.parameters,
        ...modifications
      },
      metrics: {
        episodesRun: 0,
        averageReward: 0,
        winRate: 0,
        lastUpdated: new Date().toISOString()
      }
    };
  }
}

export default OgInferenceClient;

function buildMessages(request: InferenceRequest): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: request.systemPrompt },
    { role: 'user', content: request.userMessage }
  ];
}

function parseActionPayload(
  content: string,
  legalActions: string[]
): { actionType: string; intensity: number; rationale: string } {
  const parsed = safeParseAction(content);
  const defaultAction = legalActions[0] ?? 'default-action';
  const actionType = parsed?.actionType && legalActions.includes(parsed.actionType) ? parsed.actionType : defaultAction;
  const intensity = clamp(parsed?.intensity ?? 0.55, 0.1, 1);
  const rationale = parsed?.rationale ?? `Selected ${actionType} after evaluating the current threat posture.`;

  return {
    actionType,
    intensity,
    rationale
  };
}

function safeParseAction(content: string): { actionType?: string; intensity?: number; rationale?: string } | null {
  const trimmed = content.trim();
  const candidates = [trimmed, extractJsonObject(trimmed)].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as { actionType?: string; intensity?: number; rationale?: string };
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function extractJsonObject(content: string): string | null {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  return content.slice(firstBrace, lastBrace + 1);
}

function readAttestationHeaders(headers: Headers): { signature?: string; remoteAttestationReport?: string } {
  const signature =
    headers.get('x-tee-signature') ??
    headers.get('x-response-signature') ??
    headers.get('x-signature') ??
    undefined;

  const remoteAttestationReport =
    headers.get('x-remote-attestation-report') ??
    headers.get('x-ra-report') ??
    headers.get('x-tee-report') ??
    undefined;

  return {
    signature,
    remoteAttestationReport
  };
}

function normalizeRequestHeaders(headers: object): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  );
}

function matchesRequestedModel(model: InferenceModel, service: ServiceWithDetail): boolean {
  const requestedModel = String(model).toLowerCase();
  const serviceModel = String(service.model ?? '').toLowerCase();
  const metadataName = String(service.modelInfo?.name ?? '').toLowerCase();
  return serviceModel.includes(requestedModel) || metadataName.includes(requestedModel);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
