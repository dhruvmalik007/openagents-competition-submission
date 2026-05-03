import type { OnChainActivityRecord, OperatorActionRecord, PromptTemplateRecord, RoadmapItemRecord, SimulationRunRecord } from '../types';

export function buildPromptTemplates(): PromptTemplateRecord[] {
  return [
    {
      id: 'oracle-desync',
      title: 'Oracle desynchronization drill',
      objective: 'Pressure the protocol with delayed price updates, manipulated feeds, and time-sensitive liquidation windows while the defense side preserves user funds.',
      roles: ['attacker', 'defender', 'judge'],
      recommendedSurface: 'dashboard'
    },
    {
      id: 'governance-capture',
      title: 'Governance capture attempt',
      objective: 'Simulate voter coordination, treasury pressure, and emergency controls so the ciso/cto role can prove whether governance can be contained.',
      roles: ['attacker', 'ciso', 'judge'],
      recommendedSurface: 'dashboard'
    },
    {
      id: 'bridge-failure',
      title: 'Bridge compromise stress test',
      objective: 'Model cross-chain delay, compromised relayers, and liquidity fragmentation to test both exploit detection and operator coordination.',
      roles: ['attacker', 'defender', 'ciso', 'judge'],
      recommendedSurface: 'etl'
    },
    {
      id: 'operator-confusion',
      title: 'Operator confusion response test',
      objective: 'Stress the response organization with incomplete signals, noisy alerts, and social-engineering-style uncertainty so the operator layer must escalate cleanly.',
      roles: ['attacker', 'ciso', 'defender', 'judge'],
      recommendedSurface: 'modules'
    }
  ];
}

export function buildRoadmapItems(): RoadmapItemRecord[] {
  return [
    {
      id: 'wallet-workflow',
      phase: 'live-now',
      title: 'Wallet-first CLI onboarding is live',
      summary: 'Operators can authenticate from the CLI, sync the session to the web app, and keep the control plane tied to the same wallet identity.',
      targetSurface: 'dashboard',
      dependency: 'CLI wallet login + session sync API'
    },
    {
      id: 'threat-intel-loop',
      phase: 'live-now',
      title: 'Threat-intel ETL is already part of the loop',
      summary: 'The ETL page shows Rekt and Solodit-derived context so fresh findings can seed the next red-team prompt without leaving the app.',
      targetSurface: 'etl',
      dependency: 'ETL route handlers + JSONL/Blob datasets'
    },
    {
      id: 'runtime-posture',
      phase: 'live-now',
      title: '0G execution posture is visible today',
      summary: 'The modules and settings surfaces already expose inference readiness, authenticated compute, storage, and fine-tuning prerequisites.',
      targetSurface: 'modules',
      dependency: '0G SDK readiness helper + deployment env checks'
    },
    {
      id: 'training-rounds',
      phase: 'next-up',
      title: 'Promote run metadata into training-round visibility',
      summary: 'Expose round number, variant id, lifecycle state, and active role set directly in the dashboard run table and mission-control panels.',
      targetSurface: 'dashboard',
      dependency: 'Enrich simulation manifest or derived run metadata'
    },
    {
      id: 'prompt-templates',
      phase: 'next-up',
      title: 'Make adversarial prompt templates first-class',
      summary: 'Turn common red-team strategies into reusable templates so a user can move from ETL finding to scenario launch in one workflow.',
      targetSurface: 'roadmap',
      dependency: 'CLI scenario argument or template selector'
    },
    {
      id: 'onchain-activity',
      phase: 'next-up',
      title: 'Surface on-chain settlement and agent cost traces',
      summary: 'Add payment references, transaction hashes, settlement status, and inference-cost visibility to the same mission-control surface used for run status.',
      targetSurface: 'settings',
      dependency: 'Payment event persistence or settlement adapter'
    },
    {
      id: 'fine-tuning-memory',
      phase: 'roadmap',
      title: 'Promote memory and replay data into 0G fine-tuning loops',
      summary: 'Use retained vector memory, ETL fragments, and judged run traces to build structured datasets for long-horizon policy improvement.',
      targetSurface: 'modules',
      dependency: '0G fine-tuning flow + retained datasets'
    },
    {
      id: 'alignment-node',
      phase: 'roadmap',
      title: 'Add decentralized AI alignment and operator policy controls',
      summary: 'Map operator approval, alignment-node concepts, and escalations into a human-governed multi-agent workflow.',
      targetSurface: 'roadmap',
      dependency: '0G alignment-node and operator policy integration'
    }
  ];
}

export function buildOperatorActions(run: SimulationRunRecord | null, etlJobs: number, blobConfigured: boolean): OperatorActionRecord[] {
  const actions: OperatorActionRecord[] = [];

  actions.push({
    id: 'review-threat-intel',
    title: 'Review the latest exploit patterns',
    detail: etlJobs > 0
      ? 'Open the ETL page and turn the freshest Rekt or Solodit signal into the next adversarial prompt template.'
      : 'Trigger the ETL refresh route so the operator starts from current exploit data before defining the next simulation.',
    status: etlJobs > 0 ? 'ready' : 'attention',
    targetSurface: 'etl'
  });

  actions.push({
    id: 'check-runtime',
    title: 'Confirm inference and storage posture',
    detail: 'Verify that authenticated compute, memory persistence, and fine-tuning prerequisites are visible on the modules/settings surfaces before promising a live 0G-backed run.',
    status: 'ready',
    targetSurface: 'modules'
  });

  actions.push({
    id: 'promote-run-metadata',
    title: 'Promote training metadata into mission control',
    detail: run
      ? `The latest run ${run.runId} is a good candidate for exposing round, variant, and status metadata directly in the run table.`
      : 'No simulation run is materialized yet, so the first workflow execution should seed the dashboard history before deeper training views are added.',
    status: run ? 'ready' : 'planned',
    targetSurface: 'dashboard'
  });

  actions.push({
    id: 'stabilize-artifacts',
    title: 'Decide whether artifact persistence needs production storage',
    detail: blobConfigured
      ? 'Blob persistence is already configured, so the next step is exposing richer cost/payment traces alongside the stored artifacts.'
      : 'The UI is ready with local fallbacks, but production demos become stronger once Blob-backed ETL and run artifacts are always retained.',
    status: blobConfigured ? 'planned' : 'attention',
    targetSurface: 'settings'
  });

  return actions;
}

export function buildOnChainActivity(sessionSafeAddress: string | null, lastUpdatedAt?: string): OnChainActivityRecord {
  if (!sessionSafeAddress) {
    return {
      walletLabel: 'No synced wallet yet',
      settlementStatus: 'awaiting-session',
      paymentReference: 'Sync a CLI session to unlock payment and settlement context.',
      note: 'This card is ready for agent-cost and payment traces once a wallet identity is bound to the control plane.',
      lastUpdatedAt
    };
  }

  return {
    walletLabel: sessionSafeAddress,
    settlementStatus: 'ready-for-surface',
    paymentReference: 'Roadmap surface for tx hash, inference batch cost, and settlement status.',
    note: 'The app now carries wallet context through the operator dashboard so payment visibility can land in the same mission-control loop as simulation status.',
    lastUpdatedAt
  };
}
