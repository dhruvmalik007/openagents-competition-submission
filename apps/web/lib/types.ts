export type ProtocolInventory = {
  protocolSlug: string;
  protocolName: string;
  generatedAt: string;
  contractAddresses: Array<{
    name: string;
    address: string;
    chain: string;
    category: 'core' | 'proxy' | 'oracle' | 'governance' | 'token' | 'treasury' | 'unknown';
    source: 'defillama' | 'github' | 'docs' | 'explorer' | 'manual';
    verified: boolean;
    confidence: 'low' | 'medium' | 'high';
    notes?: string;
  }>;
  offchainResources: Array<{
    type: 'github' | 'docs' | 'explorer' | 'security-report' | 'frontend' | 'api';
    label: string;
    url: string;
    source: 'defillama' | 'github' | 'docs' | 'explorer' | 'manual';
    confidence: 'low' | 'medium' | 'high';
  }>;
};

export type CliSessionMode = 'browser' | 'private-key' | 'ledger' | 'privy';

export type CliSession = {
  sessionId: string;
  safeAddress: string;
  signerAddress: string;
  rpcUrl: string;
  mode: CliSessionMode;
  issuedAt: string;
  expiresAt: string;
  challenge: string;
  signature: string;
  verifiedOwner: boolean;
};

export type PublishedCliSession = CliSession & {
  publishedAt: string;
  source: 'local-cli' | 'api';
};

export type SimulationManifest = {
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
  inferenceSummary?: SimulationInferenceSummary;
  latestAgentActions?: SimulationAgentActionSummary[];
  operatorContext?: {
    safeAddress: string;
    signerAddress: string;
    mode: CliSessionMode;
  };
  outputPaths: {
    manifestPath: string;
    epochLogPath: string;
    openenvStepLogPath: string;
  };
};

export type SimulationInferenceSummary = {
  mode: 'heuristic' | 'og-mock' | 'og-sealed';
  model: string;
  totalInferenceCalls: number;
  attestedResponses: number;
  providers: string[];
  fallbackCount: number;
  notes: string[];
};

export type SimulationAgentActionSummary = {
  role: 'attacker' | 'ciso' | 'defender' | 'judge';
  actionType: string;
  intensity: number;
  rationale?: string;
  provider?: string;
  confidence?: number;
  signaturePresent: boolean;
  remoteAttestationPresent: boolean;
  uncertainty?: string;
  timestamp: string;
};

export type EpochLog = {
  runId: string;
  scenarioId: string;
  protocolSlug: string;
  protocolName: string;
  epoch: number;
  metrics: {
    exploitSuccess: boolean;
    fundsAtRiskUsd: number;
    fundsRecoveredUsd: number;
    timeToDetectionSeconds: number;
    falsePositiveRate: number;
    incidentReplayFidelity: number;
  };
  agents: Array<{
    role: 'attacker' | 'ciso' | 'defender' | 'judge';
    actionCount: number;
    reward: number;
    observationsConsumed: number;
    memoryWrites: number;
  }>;
};

export type EtlDatasetName =
  | 'protocols'
  | 'simulations'
  | 'epochs'
  | 'agent-instances'
  | 'rekt-incidents'
  | 'solodit-findings'
  | 'module-checks';

export type RektIncidentRecord = {
  incidentId: string;
  slug: string;
  title: string;
  protocolName: string;
  sourceUrl: string;
  publishedAt: string;
  summary: string;
  excerpt: string;
  exploitType: string | null;
  tags: string[];
  lossEstimateUsd: number | null;
  chains: string[];
  attackTransactions: string[];
  involvedAddresses: string[];
  confidence: 'medium' | 'high';
};

export type SoloditFindingRecord = {
  findingId: string;
  slug: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'gas' | 'informational' | 'unknown';
  sourceUrl: string;
  source: 'solodit-sitemap';
  reportLabel: string | null;
  protocolHint: string | null;
  discoveredAt: string;
  parserConfidence: 'low' | 'medium';
};

export type ModuleCheckRecord = {
  moduleId: string;
  name: string;
  area: 'network' | 'inference' | 'storage' | 'training' | 'alignment' | 'ops';
  status: 'ready' | 'attention' | 'planned' | 'optional';
  summary: string;
  detail: string;
  sourceUrl: string;
  updatedAt: string;
};

export type EtlJobRecord = {
  jobId: string;
  source: 'manual' | 'cron' | 'api';
  status: 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  inputCount: number;
  outputCount: number;
  datasets: Array<{
    name: EtlDatasetName;
    path: string;
    recordCount: number;
  }>;
  error?: string;
};

export type ProtocolDashboardRecord = {
  protocolSlug: string;
  protocolName: string;
  incidentReference?: string;
  contractCount: number;
  verifiedContracts: number;
  resourceCount: number;
  timesSimulated: number;
  averageExploitSuccessRate: number;
  averageReplayFidelity: number;
  latestRunAt?: string;
};

export type SimulationRunRecord = SimulationManifest & {
  agentInstanceCount: number;
  epochLogs?: EpochLog[];
  source?: 'local-repository' | 'published-api';
};

export type PublishedSimulationRun = {
  manifest: SimulationManifest;
  epochLogs: EpochLog[];
  openEnvStepLogs?: Array<{
    event: 'openenv.reset' | 'openenv.step' | 'openenv.state';
    timestamp: string;
  }>;
  publishedAt: string;
};

export type DashboardTimePoint = {
  bucket: string;
  runs: number;
  agentInstances: number;
  uniqueProtocols: number;
};

export type DashboardOverview = {
  generatedAt: string;
  session: PublishedCliSession | null;
  totals: {
    inventories: number;
    redTeamedProtocols: number;
    simulationRuns: number;
    simulationEpisodes: number;
    agentInstances: number;
    vectorDocuments: number;
    etlJobs: number;
  };
  agentRoleTotals: Array<{
    role: 'attacker' | 'ciso' | 'defender' | 'judge';
    reward: number;
    actionCount: number;
    memoryWrites: number;
  }>;
  latestRun: SimulationRunRecord | null;
  pipelineHealth: {
    localRepositoryReadable: boolean;
    blobConfigured: boolean;
    vectorDbConfigured: boolean;
    vectorDimension: number;
  };
  missionControl: MissionControlSummary;
  operatorActions: OperatorActionRecord[];
  promptTemplates: PromptTemplateRecord[];
  roadmap: RoadmapItemRecord[];
  onChainActivity: OnChainActivityRecord;
};

export type DashboardSnapshot = {
  overview: DashboardOverview;
  protocols: ProtocolDashboardRecord[];
  runs: SimulationRunRecord[];
  timeseries: DashboardTimePoint[];
};

export type MissionControlSummary = {
  heading: string;
  phase: 'awaiting-run' | 'monitoring' | 'training-ready';
  statusLabel: string;
  summary: string;
  runId?: string;
  scenarioId?: string;
  networkLabel: string;
  protocolCount: number;
  episodeBudget: number;
  stepsPerEpisode: number;
  inferenceTrack: string;
  lastUpdatedAt?: string;
  roleLabels: string[];
};

export type OperatorActionRecord = {
  id: string;
  title: string;
  detail: string;
  status: 'ready' | 'attention' | 'planned';
  targetSurface: 'dashboard' | 'etl' | 'modules' | 'settings' | 'roadmap';
};

export type PromptTemplateRecord = {
  id: string;
  title: string;
  objective: string;
  roles: Array<'attacker' | 'ciso' | 'defender' | 'judge'>;
  recommendedSurface: 'dashboard' | 'etl' | 'modules';
};

export type RoadmapItemRecord = {
  id: string;
  phase: 'live-now' | 'next-up' | 'roadmap';
  title: string;
  summary: string;
  targetSurface: 'dashboard' | 'etl' | 'modules' | 'settings' | 'roadmap';
  dependency: string;
};

export type OnChainActivityRecord = {
  walletLabel: string;
  settlementStatus: 'awaiting-session' | 'ready-for-surface' | 'roadmapped';
  paymentReference: string;
  note: string;
  lastUpdatedAt?: string;
};

export type VectorDocumentRecord = {
  id: string;
  userId: string;
  safeAddress: string;
  namespace: string;
  documentType: 'run-memory' | 'protocol-note' | 'rlhf-feedback' | 'etl-fragment';
  content: string;
  metadata: Record<string, unknown>;
  embeddingModel: string;
  similarity?: number;
  createdAt: string;
  updatedAt: string;
};

export type VectorUpsertInput = {
  userId: string;
  safeAddress: string;
  namespace: string;
  documentType: VectorDocumentRecord['documentType'];
  content: string;
  metadata?: Record<string, unknown>;
};

export type VectorSearchInput = {
  userId: string;
  safeAddress: string;
  namespace: string;
  query: string;
  limit?: number;
};

export type VectorSpec = {
  provider: 'neon-pgvector' | 'local-json';
  dimension: number;
  embeddingModel: string;
  tables: Array<{
    name: string;
    purpose: string;
    keyColumns: string[];
  }>;
  storageLayout: {
    jsonlBlobs: string[];
    database: string[];
  };
  guarantees: string[];
};

export type InventoryRecord = ProtocolInventory & {
  summary?: {
    incidentReference?: string;
    confidence?: 'low' | 'medium' | 'high';
  };
};
