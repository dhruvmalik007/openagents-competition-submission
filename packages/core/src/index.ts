export type EpochLogTemplateInput = {
  runId: string;
  scenarioId: string;
  network: string;
};

export type ResearchProgramInput = {
  scenarioId: string;
  baselineBranch?: string;
  metricName?: string;
  timeBudgetSeconds?: number;
};

export type EpochLog = {
  event: 'epoch.completed';
  runId: string;
  scenarioId: string;
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
  };
  artifacts: {
    tracePath: string;
    memorySnapshotPath: string;
    reportPath: string;
  };
};

export type ResearchProgram = {
  controlFile: string;
  editableTargets: string[];
  baselineBranch: string;
  objective: {
    metricName: string;
    direction: 'minimize' | 'maximize';
    timeBudgetSeconds: number;
  };
  loop: Array<'baseline' | 'mutate' | 'evaluate' | 'keep-or-reset' | 'log-result'>;
  outputs: {
    resultsLedgerPath: string;
    scenarioProgramPath: string;
    artifactRoot: string;
  };
};

export type OgTestPlanInput = {
  scenarioId: string;
  safeAddress?: string;
};

export type OgTestPlan = {
  network: {
    name: '0G-Galileo-Testnet';
    chainId: 16602;
    rpcUrl: string;
    faucetUrl: string;
  };
  identities: {
    operatorSafe: string;
    onboarding: Array<{
      step: string;
      command: string;
      outcome: string;
    }>;
  };
  preflightToolcalls: Array<{
    tool: 'mcp_parallel_sear_web_fetch';
    objective: string;
    urls: string[];
    output: string;
  }>;
  validationFlow: Array<{
    phase: 'funding' | 'orchestration' | 'attestation' | 'persistence';
    action: string;
    successCriteria: string;
  }>;
  artifacts: {
    attestationReportPath: string;
    runManifestPath: string;
    storageSyncPath: string;
  };
};

export function buildEpochLogTemplate(input: EpochLogTemplateInput): EpochLog {
  return {
    event: 'epoch.completed',
    runId: input.runId,
    scenarioId: input.scenarioId,
    epoch: 1,
    network: input.network,
    inference: {
      provider: '0g-testnet',
      mode: 'evaluator',
      modelHint: 'qwen3.6-plus or testnet-configured sealed inference model'
    },
    agents: [
      { role: 'attacker', actionCount: 5, reward: 0.68, observationsConsumed: 11, memoryWrites: 2 },
      { role: 'ciso', actionCount: 2, reward: 0.52, observationsConsumed: 5, memoryWrites: 1 },
      { role: 'defender', actionCount: 4, reward: 0.74, observationsConsumed: 8, memoryWrites: 3 },
      { role: 'judge', actionCount: 1, reward: 0.0, observationsConsumed: 14, memoryWrites: 1 }
    ],
    metrics: {
      exploitSuccess: false,
      fundsAtRiskUsd: 18400000,
      fundsRecoveredUsd: 9000000,
      timeToDetectionSeconds: 143,
      falsePositiveRate: 0.07
    },
    artifacts: {
      tracePath: `runs/${input.runId}/epochs/001.trace.jsonl`,
      memorySnapshotPath: `runs/${input.runId}/epochs/001.memory.json`,
      reportPath: `runs/${input.runId}/reports/epoch-001.md`
    }
  };
}

export function buildResearchProgram(input: ResearchProgramInput): ResearchProgram {
  return {
    controlFile: `research/${input.scenarioId}/program.md`,
    editableTargets: [`research/${input.scenarioId}/policy.ts`, `research/${input.scenarioId}/reward-config.json`],
    baselineBranch: input.baselineBranch ?? 'main',
    objective: {
      metricName: input.metricName ?? 'defender_net_recovery_usd',
      direction: 'maximize',
      timeBudgetSeconds: input.timeBudgetSeconds ?? 300
    },
    loop: ['baseline', 'mutate', 'evaluate', 'keep-or-reset', 'log-result'],
    outputs: {
      resultsLedgerPath: `research/${input.scenarioId}/results.tsv`,
      scenarioProgramPath: `research/${input.scenarioId}/program.md`,
      artifactRoot: `runs/research/${input.scenarioId}`
    }
  };
}

export function buildOgTestPlan(input: OgTestPlanInput): OgTestPlan {
  return {
    network: {
      name: '0G-Galileo-Testnet',
      chainId: 16602,
      rpcUrl: 'https://evmrpc-testnet.0g.ai',
      faucetUrl: 'https://faucet.0g.ai'
    },
    identities: {
      operatorSafe: input.safeAddress ?? '0x0000000000000000000000000000000000000000',
      onboarding: [
        {
          step: 'load-safe',
          command: 'safe-cli <safe_address> https://evmrpc-testnet.0g.ai',
          outcome: 'Safe metadata and threshold owners are loaded against the Galileo RPC endpoint.'
        },
        {
          step: 'load-ledger-owner',
          command: 'load_ledger_cli_owners --derivation-path "m/44\'/60\'/0\'/0/0"',
          outcome: 'At least one Ledger-backed Safe owner is available to sign testnet operations.'
        },
        {
          step: 'issue-cli-session',
          command: 'aegis login safe --ledger --safe <safe_address>',
          outcome: 'The CLI binds a short-lived workspace session to the Safe-controlled identity.'
        }
      ]
    },
    preflightToolcalls: [
      {
        tool: 'mcp_parallel_sear_web_fetch',
        objective: 'Fetch the current 0G Galileo faucet and builder docs before running a scenario so endpoints and testing assumptions stay fresh.',
        urls: ['https://faucet.0g.ai/', 'https://docs.0g.ai/', 'https://0g.ai/blog/introducing-v3-testnet-galileo'],
        output: 'Attach fetched notes to runs/<scenario>/preflight/0g-sources.json'
      },
      {
        tool: 'mcp_parallel_sear_web_fetch',
        objective: 'Fetch Safe CLI common commands to verify Ledger-owner onboarding steps before signing or sending transactions.',
        urls: ['https://docs.safe.global/advanced/cli-reference/common-commands'],
        output: 'Attach fetched notes to runs/<scenario>/preflight/safe-ledger-sources.json'
      }
    ],
    validationFlow: [
      {
        phase: 'funding',
        action: 'Request 0G testnet funds from the Galileo faucet for the Safe owner or delegated execution account.',
        successCriteria: 'Wallet receives enough 0G to cover Safe transaction execution and storage/inference smoke tests.'
      },
      {
        phase: 'orchestration',
        action: 'Start the Kurtosis enclave, point the coordinator at Galileo RPC, and run a short attacker/defender scenario.',
        successCriteria: 'A run manifest and at least one epoch log are emitted without RPC or signer failures.'
      },
      {
        phase: 'attestation',
        action: 'Capture the 0G inference response signature and, when available from the provider path, archive the remote attestation report alongside the response.',
        successCriteria: 'Each evaluated inference call is associated with verifiable proof material and an attestation status in the run manifest.'
      },
      {
        phase: 'persistence',
        action: 'Upload epoch logs, Safe auth audit records, and attestation artifacts to 0G-backed storage.',
        successCriteria: 'Storage sync status is recorded and the artifact index resolves all uploaded paths.'
      }
    ],
    artifacts: {
      attestationReportPath: `runs/${input.scenarioId}/attestation/latest-report.json`,
      runManifestPath: `runs/${input.scenarioId}/manifest.json`,
      storageSyncPath: `runs/${input.scenarioId}/storage-sync.json`
    }
  };
}
