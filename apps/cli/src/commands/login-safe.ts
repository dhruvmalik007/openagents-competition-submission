import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { buildDirectWalletSession, buildPrivySession, buildVerifiedSession, createChallenge, createWalletChallenge, loadSafeInfo, loginWithBrowser, loginWithBrowserWallet, loginWithLedger, loginWithPrivateKey } from '../utils/safe-auth.js';
import { clearSession, loadSession, saveSession } from '../utils/session-store.js';
import { galileoTestnet } from '@aegis-arena/og';
import { getAddress } from 'viem';

type LoginSafeOptions = {
  safe: string;
  rpc: string;
  mode?: 'browser' | 'private-key' | 'ledger';
  privateKey?: string;
  ledgerDerivationPath: string;
  noOpen?: boolean;
  timeoutSeconds: string;
};

type SyncWebOptions = {
  baseUrl: string;
  privyAccessToken?: string;
};

type LoginWalletOptions = {
  rpc: string;
  mode?: 'browser' | 'ledger' | 'privy';
  ledgerDerivationPath: string;
  noOpen?: boolean;
  timeoutSeconds: string;
  address?: string;
};

export async function chooseLoginMode(): Promise<'browser' | 'private-key' | 'ledger'> {
  const rl = createInterface({ input, output });

  try {
    console.log('Choose a login mode:');
    console.log('  1) browser      - Safe owner signs in an injected browser wallet');
    console.log('  2) ledger       - Safe owner signs via a Ledger or USB hardware wallet');
    console.log('  3) private-key  - developer fallback for direct owner EOA signing');
    const answer = (await rl.question('Select 1, 2, or 3: ')).trim();

    if (answer === '2' || answer.toLowerCase() === 'ledger') {
      return 'ledger';
    }
    if (answer === '3' || answer.toLowerCase() === 'private-key') {
      return 'private-key';
    }
    return 'browser';
  } finally {
    rl.close();
  }
}

async function chooseWalletLoginMode(): Promise<'browser' | 'ledger' | 'privy'> {
  const rl = createInterface({ input, output });

  try {
    console.log('Choose a wallet login mode:');
    console.log('  1) browser  - sign in with a personal wallet in the browser');
    console.log('  2) ledger   - validate a Ledger wallet directly in the CLI');
    console.log('  3) privy    - use a Privy-authenticated wallet session');
    const answer = (await rl.question('Select 1, 2, or 3: ')).trim();

    if (answer === '2' || answer.toLowerCase() === 'ledger') return 'ledger';
    if (answer === '3' || answer.toLowerCase() === 'privy') return 'privy';
    return 'browser';
  } finally {
    rl.close();
  }
}

async function promptWalletAddress(promptLabel = 'Wallet address'): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${promptLabel}: `)).trim();
    return getAddress(answer);
  } finally {
    rl.close();
  }
}

export async function handleLoginSafe(options: LoginSafeOptions): Promise<void> {
  const mode = options.mode ?? await chooseLoginMode();
  const safeInfo = await loadSafeInfo(options.safe, options.rpc);
  const challenge = createChallenge(safeInfo.safeAddress, options.rpc, mode);

  console.log(`Loaded Safe ${safeInfo.safeAddress}`);
  console.log(`Owners: ${safeInfo.owners.join(', ')}`);
  console.log(`Threshold: ${safeInfo.threshold}`);

  const timeoutMs = Number(options.timeoutSeconds) * 1000;
  let result: { signerAddress: string; signature: `0x${string}` };

  if (mode === 'private-key') {
    if (!options.privateKey) {
      throw new Error('Private-key mode requires --private-key or AEGIS_PRIVATE_KEY.');
    }

    result = await loginWithPrivateKey(options.privateKey as `0x${string}`, challenge);
  } else if (mode === 'ledger') {
    result = await loginWithLedger(options.ledgerDerivationPath, challenge);
  } else {
    result = await loginWithBrowser(safeInfo.safeAddress, challenge, !options.noOpen, timeoutMs);
  }

  const session = await buildVerifiedSession({
    safeAddress: safeInfo.safeAddress,
    rpcUrl: options.rpc,
    mode,
    challenge,
    signature: result.signature,
    signerAddress: result.signerAddress
  });

  saveSession(session);
  console.log(JSON.stringify(session, null, 2));
}

export function handleLoginStatus(): void {
  const session = loadSession();

  if (!session) {
    console.log('No active Aegis Safe session found.');
    return;
  }

  console.log(JSON.stringify(session, null, 2));
}

export function handleLogout(): void {
  clearSession();
  console.log('Cleared local Aegis Safe session.');
}

export async function handleLoginWallet(options: LoginWalletOptions): Promise<void> {
  const mode = options.mode ?? await chooseWalletLoginMode();
  const timeoutMs = Number(options.timeoutSeconds) * 1000;

  if (mode === 'privy') {
    const walletAddress = options.address ? getAddress(options.address) : await promptWalletAddress('Privy wallet address');
    const session = buildPrivySession({ rpcUrl: options.rpc, walletAddress });
    saveSession(session);
    console.log(JSON.stringify(session, null, 2));
    console.log('Use `aegis login sync-web --privy-access-token <token>` to publish this Privy-authenticated session.');
    return;
  }

  const challenge = createWalletChallenge(options.rpc, mode);
  const result = mode === 'ledger'
    ? await loginWithLedger(options.ledgerDerivationPath, challenge)
    : await loginWithBrowserWallet(challenge, !options.noOpen, timeoutMs);

  const session = await buildDirectWalletSession({
    rpcUrl: options.rpc,
    mode,
    challenge,
    signature: result.signature,
    signerAddress: result.signerAddress
  });

  saveSession(session);
  console.log(JSON.stringify(session, null, 2));
}

export async function handleSyncWeb(options: SyncWebOptions): Promise<void> {
  const session = loadSession();

  if (!session) {
    throw new Error('No active Safe session found. Run `aegis login safe` first.');
  }

  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };
  if (options.privyAccessToken?.trim()) {
    headers.authorization = `Bearer ${options.privyAccessToken.trim()}`;
  }
  const response = await fetch(`${baseUrl}/api/auth/cli-session`, {
    method: 'POST',
    headers,
    body: JSON.stringify(session)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to publish session to web backend (${response.status}). ${body}`);
  }

  const payload = await response.json();
  console.log(JSON.stringify(payload, null, 2));
}

export function registerLoginCommands(program: Command): void {
  const login = program.command('login').description('Authenticate and manage local CLI sessions');

  login
    .command('safe')
    .description('Authenticate against a Safe using a browser wallet, private key, or Ledger-backed signer')
    .requiredOption('--safe <address>', 'safe address to authenticate against')
    .option('--rpc <url>', 'EVM RPC URL used to inspect Safe owners', galileoTestnet.rpcUrl)
    .option('--mode <mode>', 'signer mode: browser, private-key, or ledger; omit to choose interactively')
    .option('--private-key <hex>', 'EOA private key used for direct owner authentication', process.env.AEGIS_PRIVATE_KEY)
    .option('--ledger-derivation-path <path>', 'Ledger derivation path used to load the owner address', `m/44'/60'/0'/0/0`)
    .option('--no-open', 'Do not automatically open the local browser signing page')
    .option('--timeout-seconds <seconds>', 'Browser signing timeout in seconds', '120')
    .action(async (options: LoginSafeOptions) => {
      await handleLoginSafe(options);
    });

  login
    .command('wallet')
    .description('Authenticate with a direct wallet flow: browser wallet, Ledger, or Privy-backed wallet identity')
    .option('--rpc <url>', 'EVM RPC URL used for wallet-linked simulation context', galileoTestnet.rpcUrl)
    .option('--mode <mode>', 'login mode: browser, ledger, or privy; omit to choose interactively')
    .option('--ledger-derivation-path <path>', 'Ledger derivation path used to load the wallet address', `m/44'/60'/0'/0/0`)
    .option('--no-open', 'Do not automatically open the local browser signing page')
    .option('--timeout-seconds <seconds>', 'Browser signing timeout in seconds', '120')
    .option('--address <walletAddress>', 'wallet address to associate with a Privy-authenticated session')
    .action(async (options: LoginWalletOptions) => {
      await handleLoginWallet(options);
    });

  login
    .command('sync-web')
    .description('Publish the active Safe session to the web backend so the SPA can bind dashboard state to the authenticated wallet')
    .requiredOption('--base-url <url>', 'base URL for the web app, for example http://localhost:3000')
    .option('--privy-access-token <token>', 'Privy access token used to authorize the sync request', process.env.AEGIS_PRIVY_ACCESS_TOKEN)
    .action(async (options: SyncWebOptions) => {
      await handleSyncWeb(options);
    });

  login
    .command('status')
    .description('Print the active local Safe session, if any')
    .action(handleLoginStatus);

  login
    .command('logout')
    .description('Clear the active local Safe session')
    .action(handleLogout);
}