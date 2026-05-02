export type CliAction = {
  command: string;
  purpose: string;
  outputs: string[];
  logs: string[];
};

export const cliManifest: CliAction[] = [
  {
    command: 'aegis login safe',
    purpose: 'Authenticate against a Safe by verifying that a browser-wallet, private-key, or Ledger signer is an onchain Safe owner, then issue a short-lived local workspace session.',
    outputs: ['session token', 'workspace binding', 'auth audit log'],
    logs: ['auth.challenge.created', 'auth.challenge.signed', 'auth.session.issued']
  },
  {
    command: 'aegis login safe --ledger --safe <address>',
    purpose: 'Bind a Safe workspace session using a Ledger-backed owner flow before testnet orchestration begins.',
    outputs: ['session token', 'safe owner fingerprint', 'ledger onboarding audit'],
    logs: ['auth.safe.loaded', 'auth.ledger.owner.loaded', 'auth.session.issued']
  },
  {
    command: 'aegis login status',
    purpose: 'Inspect the active local Safe-authenticated CLI session.',
    outputs: ['session json'],
    logs: ['auth.session.read']
  },
  {
    command: 'aegis login logout',
    purpose: 'Clear the active local Safe-authenticated CLI session.',
    outputs: ['logout confirmation'],
    logs: ['auth.session.cleared']
  },
  {
    command: 'aegis sources sync rekt --year 2026',
    purpose: 'Fetch and normalize Rekt News incidents into structured attack records.',
    outputs: ['raw article cache', 'normalized incidents JSONL', 'dedupe report'],
    logs: ['etl.source.page_fetched', 'etl.article.parsed', 'etl.incident.normalized']
  },
  {
    command: 'aegis inventory enrich --protocol <slug>',
    purpose: 'Resolve onchain and offchain protocol metadata from DeFiLlama, docs, GitHub, explorers, and curated manifests.',
    outputs: ['protocol inventory JSON', 'resource manifest', 'confidence report'],
    logs: ['inventory.lookup.started', 'inventory.address.resolved', 'inventory.resource.attached']
  },
  {
    command: 'aegis research init --scenario <id>',
    purpose: 'Create a Karpathy-style autoresearch control loop with a scenario program, fixed budget, and append-only experiment ledger.',
    outputs: ['program.md', 'results.tsv', 'baseline run manifest'],
    logs: ['research.program.created', 'research.baseline.started', 'research.baseline.completed']
  },
  {
    command: 'aegis research loop --scenario <id> --iterations <n>',
    purpose: 'Run the keep-or-reset experimentation loop for attacker and defender policy variants under a bounded epoch budget.',
    outputs: ['experiment artifacts', 'results ledger rows', 'accepted policy variants'],
    logs: ['research.iteration.started', 'research.metric.recorded', 'research.variant.accepted', 'research.variant.reverted']
  },
  {
    command: 'aegis scenario build --incident <id>',
    purpose: 'Compile an incident and protocol inventory into a scenario package consumable by the simulator.',
    outputs: ['scenario.yaml', 'contracts.json', 'reward-config.json', 'playbook.md'],
    logs: ['scenario.compile.started', 'scenario.graph.built', 'scenario.compile.finished']
  },
  {
    command: 'aegis infra kurtosis render --scenario <id>',
    purpose: 'Render a reproducible Kurtosis package for the chain, bridge, agent-coordinator, and artifact services required by a scenario.',
    outputs: ['main.star', 'kurtosis.yml', 'enclave parameters'],
    logs: ['infra.kurtosis.render.started', 'infra.kurtosis.service.defined', 'infra.kurtosis.render.completed']
  },
  {
    command: 'aegis og faucet claim --address <address>',
    purpose: 'Open the Galileo faucet in a browser, poll the target address balance over RPC, and persist a local claim receipt.',
    outputs: ['funding receipt', 'address balance snapshot', 'faucet audit record'],
    logs: ['og.faucet.requested', 'og.faucet.confirmed', 'og.balance.checked']
  },
  {
    command: 'aegis og balance --address <address>',
    purpose: 'Read the current 0G balance for an address or the active session signer.',
    outputs: ['balance json'],
    logs: ['og.balance.checked']
  },
  {
    command: 'aegis og attestation verify --run <id>',
    purpose: 'Verify that 0G-backed inference calls in a run have associated signature material and, when available, remote attestation artifacts.',
    outputs: ['attestation report', 'signature summary', 'verification status'],
    logs: ['og.attestation.collected', 'og.attestation.verified', 'og.attestation.failed']
  },
  {
    command: 'aegis og test-plan --scenario <id>',
    purpose: 'Print the detailed Galileo Safe/Ledger onboarding, faucet, orchestration, and attestation validation plan for a scenario.',
    outputs: ['test plan json', 'preflight toolcall checklist', 'artifact path plan'],
    logs: ['og.test-plan.generated']
  },
  {
    command: 'aegis sim run --scenario <id> --episodes <n>',
    purpose: 'Run attacker, defender, and evaluator agents across repeated episodes with 0G-backed inference.',
    outputs: ['run manifest', 'epoch logs', 'scorecards', 'reflection memory'],
    logs: ['run.started', 'epoch.started', 'agent.action', 'epoch.completed', 'run.completed']
  },
  {
    command: 'aegis sim train --scenario <id> --epochs <n>',
    purpose: 'Iterate prompt policies, heuristics, and memory across epochs to improve attacker and defender behavior.',
    outputs: ['policy checkpoints', 'training summaries', 'updated memory snapshots'],
    logs: ['train.started', 'train.epoch.feedback', 'train.policy.updated', 'train.completed']
  },
  {
    command: 'aegis report generate --run <id>',
    purpose: 'Render mitigation findings, failure modes, and run summaries for humans and downstream systems.',
    outputs: ['markdown report', 'json report', 'artifact index'],
    logs: ['report.started', 'report.section.generated', 'report.completed']
  }
];

export function formatCommandSummary(actions: CliAction[]): string {
  return actions
    .map((action) => `- ${action.command}: ${action.purpose}`)
    .join('\n');
}
