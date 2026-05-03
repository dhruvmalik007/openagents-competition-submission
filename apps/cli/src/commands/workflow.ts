import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { galileoTestnet } from '@aegis-arena/og';
import { handleLoginSafe, handleLoginWallet, handleSyncWeb } from './login-safe.js';
import { handleSimRun, handleSimTrain } from './sim.js';

type WorkflowBaseOptions = {
  safe?: string;
  baseUrl: string;
  rpc: string;
  auth?: 'safe' | 'browser' | 'ledger' | 'privy';
  mode?: 'browser' | 'private-key' | 'ledger';
  privateKey?: string;
  ledgerDerivationPath: string;
  noOpen?: boolean;
  timeoutSeconds: string;
  etl: boolean;
  address?: string;
  privyAccessToken?: string;
};

type WorkflowRunOptions = WorkflowBaseOptions & {
  scenario?: string;
  episodes: string;
  steps: string;
  slug?: string;
  inference?: 'heuristic' | 'og-mock' | 'og-sealed';
  model?: string;
};

type WorkflowTrainOptions = WorkflowBaseOptions & {
  scenario?: string;
  rounds: string;
  variants: string;
  episodes: string;
  steps: string;
  slug?: string;
  inference?: 'heuristic' | 'og-mock' | 'og-sealed';
  model?: string;
};

async function triggerEtl(baseUrl: string): Promise<void> {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');
  const response = await fetch(`${normalizedBaseUrl}/api/etl/run?source=api`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to trigger ETL refresh (${response.status}). ${body}`);
  }

  const payload = await response.json();
  console.log(JSON.stringify({ etl: payload }, null, 2));
}

async function chooseWorkflowAuthMode(): Promise<'browser' | 'ledger' | 'privy'> {
  const rl = createInterface({ input, output });
  try {
    console.log('Choose how to authenticate this workflow:');
    console.log('  1) browser  - go to the browser and sign in with a personal wallet');
    console.log('  2) ledger   - validate a Ledger wallet directly in the CLI');
    console.log('  3) privy    - authenticate using a Privy wallet session');
    const answer = (await rl.question('Select 1, 2, or 3: ')).trim();
    if (answer === '2' || answer.toLowerCase() === 'ledger') return 'ledger';
    if (answer === '3' || answer.toLowerCase() === 'privy') return 'privy';
    return 'browser';
  } finally {
    rl.close();
  }
}

async function bootstrapWorkflow(options: WorkflowBaseOptions): Promise<void> {
  const authMode = options.auth ?? (options.safe ? 'safe' : await chooseWorkflowAuthMode());
  console.log('==> Step 1/3: authenticating operator session');
  if (authMode === 'safe') {
    if (!options.safe) {
      throw new Error('Safe authentication requires --safe <address>. Omit --auth safe to use browser wallet, Ledger, or Privy instead.');
    }

    await handleLoginSafe({
      safe: options.safe,
      rpc: options.rpc,
      mode: options.mode,
      privateKey: options.privateKey,
      ledgerDerivationPath: options.ledgerDerivationPath,
      noOpen: options.noOpen,
      timeoutSeconds: options.timeoutSeconds
    });
  } else {
    await handleLoginWallet({
      rpc: options.rpc,
      mode: authMode,
      ledgerDerivationPath: options.ledgerDerivationPath,
      noOpen: options.noOpen,
      timeoutSeconds: options.timeoutSeconds,
      address: options.address
    });
  }

  console.log('==> Step 2/3: syncing local session to web control plane');
  await handleSyncWeb({ baseUrl: options.baseUrl, privyAccessToken: options.privyAccessToken });

  if (options.etl) {
    console.log('==> Step 3/3: refreshing ETL datasets on the web control plane');
    await triggerEtl(options.baseUrl);
  }
}

export function registerWorkflowCommands(program: Command): void {
  const workflow = program.command('workflow').description('End-to-end CLI flows: Safe login, web sync, ETL refresh, and simulation/training');

  workflow
    .command('run')
    .description('Authenticate, sync to the web app, optionally refresh ETL, then run a simulation')
    .requiredOption('--base-url <url>', 'base URL for the web app, for example https://aegis-0g-openagents-hackathon.vercel.app')
    .option('--safe <address>', 'optional Safe address when using Safe-owner authentication')
    .option('--auth <mode>', 'authentication strategy: safe | browser | ledger | privy')
    .option('--rpc <url>', 'EVM RPC URL used to inspect Safe owners', galileoTestnet.rpcUrl)
    .option('--mode <mode>', 'signer mode: browser, private-key, or ledger; omit to choose interactively')
    .option('--private-key <hex>', 'EOA private key used for direct owner authentication', process.env.AEGIS_PRIVATE_KEY)
    .option('--ledger-derivation-path <path>', 'Ledger derivation path used to load the owner address', `m/44'/60'/0'/0/0`)
    .option('--no-open', 'Do not automatically open the local browser signing page')
    .option('--timeout-seconds <seconds>', 'Browser signing timeout in seconds', '120')
    .option('--address <walletAddress>', 'wallet address to associate with a Privy-authenticated session')
    .option('--privy-access-token <token>', 'Privy access token used when syncing a Privy-authenticated session', process.env.AEGIS_PRIVY_ACCESS_TOKEN)
    .option('--no-etl', 'Skip triggering the remote ETL refresh before simulation')
    .option('--scenario <scenarioId>', 'scenario identifier', 'data/protocol-inventory')
    .option('--episodes <count>', 'episodes per protocol', '1')
    .option('--steps <count>', 'max multi-step turns per episode (OpenEnv style)', '8')
    .option('--inference <mode>', 'action generation mode: heuristic | og-mock | og-sealed', 'og-mock')
    .option('--model <name>', 'inference model hint', 'llama-3.3-70b-instruct')
    .option('--slug <slug>', 'optional protocol slug to simulate; defaults to every bundled protocol')
    .action(async (options: WorkflowRunOptions) => {
      await bootstrapWorkflow(options);
      console.log('==> Step 4/4: running multi-agent simulation');
      await handleSimRun({
        scenario: options.scenario,
        episodes: options.episodes,
        steps: options.steps,
        slug: options.slug,
        inference: options.inference,
        model: options.model as never
      });
    });

  workflow
    .command('train')
    .description('Authenticate, sync to the web app, optionally refresh ETL, then run policy training')
    .requiredOption('--base-url <url>', 'base URL for the web app, for example https://aegis-0g-openagents-hackathon.vercel.app')
    .option('--safe <address>', 'optional Safe address when using Safe-owner authentication')
    .option('--auth <mode>', 'authentication strategy: safe | browser | ledger | privy')
    .option('--rpc <url>', 'EVM RPC URL used to inspect Safe owners', galileoTestnet.rpcUrl)
    .option('--mode <mode>', 'signer mode: browser, private-key, or ledger; omit to choose interactively')
    .option('--private-key <hex>', 'EOA private key used for direct owner authentication', process.env.AEGIS_PRIVATE_KEY)
    .option('--ledger-derivation-path <path>', 'Ledger derivation path used to load the owner address', `m/44'/60'/0'/0/0`)
    .option('--no-open', 'Do not automatically open the local browser signing page')
    .option('--timeout-seconds <seconds>', 'Browser signing timeout in seconds', '120')
    .option('--address <walletAddress>', 'wallet address to associate with a Privy-authenticated session')
    .option('--privy-access-token <token>', 'Privy access token used when syncing a Privy-authenticated session', process.env.AEGIS_PRIVY_ACCESS_TOKEN)
    .option('--no-etl', 'Skip triggering the remote ETL refresh before training')
    .option('--scenario <scenarioId>', 'scenario identifier', 'data/protocol-inventory')
    .option('--rounds <count>', 'number of GRPO rounds', '2')
    .option('--variants <count>', 'policy variants per round', '3')
    .option('--episodes <count>', 'episodes per variant', '1')
    .option('--steps <count>', 'max steps per episode', '8')
    .option('--inference <mode>', 'action generation mode: heuristic | og-mock | og-sealed', 'og-mock')
    .option('--model <name>', 'inference model hint', 'llama-3.3-70b-instruct')
    .option('--slug <slug>', 'optional protocol slug to train on; defaults to every bundled protocol')
    .action(async (options: WorkflowTrainOptions) => {
      await bootstrapWorkflow(options);
      console.log('==> Step 4/4: running multi-agent policy training');
      await handleSimTrain({
        scenario: options.scenario,
        rounds: options.rounds,
        variants: options.variants,
        episodes: options.episodes,
        steps: options.steps,
        slug: options.slug,
        inference: options.inference,
        model: options.model as never
      });
    });
}