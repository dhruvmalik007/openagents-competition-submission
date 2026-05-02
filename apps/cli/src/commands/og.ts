import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { createPublicClient, formatEther, getAddress, http } from 'viem';
import {
  createFineTuningTask,
  createFineTuningTaskFromDatasetPath,
  downloadAgentMemorySnapshot,
  galileoTestnet,
  getOgRuntimeReadiness,
  listFineTuningModels,
  listFineTuningServices,
  listInferenceServices,
  mainnet,
  uploadAgentMemorySnapshot,
  uploadFileToStorage
} from '@aegis-arena/og';
import type { OgNetwork } from '@aegis-arena/og';
import { openBrowser } from '../utils/open-browser.js';
import { getAegisHome, getFaucetClaimsDir, loadSession } from '../utils/session-store.js';
import { isLedgerConnected, waitForLedgerDevice } from '../utils/ledger-service.js';

const commandDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(commandDir, '..', '..', '..', '..');

type OgFaucetClaimOptions = {
  address?: string;
  rpc: string;
  provider: 'official' | 'gcloud';
  open: boolean;
  pollSeconds: string;
  timeoutSeconds: string;
};

type OgBalanceOptions = {
  address?: string;
  rpc: string;
};

type OgStatusOptions = {
  rpc: string;
  indexerRpc?: string;
  network?: OgNetwork;
  providerAddress?: string;
};

type OgProvidersOptions = {
  rpc: string;
  service: 'inference' | 'fine-tuning';
  detailed: boolean;
  includeUnacknowledged?: boolean;
  limit: string;
};

type OgStorageUploadOptions = {
  file?: string;
  rpc: string;
  indexerRpc?: string;
  network?: OgNetwork;
};

type OgMemoryPushOptions = {
  agent?: string;
  file?: string;
  rpc: string;
  indexerRpc?: string;
  network?: OgNetwork;
};

type OgMemoryPullOptions = {
  root: string;
  out?: string;
  rpc: string;
  indexerRpc?: string;
  network?: OgNetwork;
};

type OgFineTuningCreateTaskOptions = {
  provider: string;
  model: string;
  datasetPath?: string;
  datasetRootHash?: string;
  configPath?: string;
  rpc: string;
  indexerRpc?: string;
  network?: OgNetwork;
  gasPrice?: string;
};

type FaucetReceipt = {
  address: string;
  rpcUrl: string;
  provider: 'official' | 'gcloud';
  faucetUrl: string;
  startedAt: string;
  completedAt: string;
  initialBalanceWei: string;
  finalBalanceWei: string;
  deltaWei: string;
  success: boolean;
};

function resolveAddress(input?: string): string {
  if (input) {
    return getAddress(input);
  }

  const session = loadSession();
  if (session) {
    return getAddress(session.signerAddress);
  }

  throw new Error('No address provided. Pass --address or create a Safe session first with `aegis login safe`.');
}

function getFaucetUrl(provider: 'official' | 'gcloud'): string {
  return provider === 'official'
    ? (galileoTestnet.faucetUrl ?? 'https://faucet.0g.ai')
    : 'https://cloud.google.com/application/web3/faucet/0g/galileo';
}

async function getBalanceWei(address: string, rpcUrl: string): Promise<bigint> {
  const client = createPublicClient({ transport: http(rpcUrl) });
  return client.getBalance({ address: getAddress(address) });
}

async function handleOgBalance(options: OgBalanceOptions): Promise<void> {
  const address = resolveAddress(options.address);
  const balance = await getBalanceWei(address, options.rpc);

  console.log(
    JSON.stringify(
      {
        address,
        rpcUrl: options.rpc,
        balanceWei: balance.toString(),
        balance0G: formatEther(balance)
      },
      null,
      2
    )
  );
}

async function handleOgStatus(options: OgStatusOptions): Promise<void> {
  const endpoints = resolveNetworkEndpoints(options.network, options.rpc, options.indexerRpc);
  const readiness = getOgRuntimeReadiness({
    network: options.network,
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl,
    providerAddress: options.providerAddress
  });
  const networkConfig = readiness.network === 'mainnet' ? mainnet : galileoTestnet;

  console.log(
    JSON.stringify(
      {
        network: networkConfig.networkName,
        chainId: networkConfig.chainId,
        rpcUrl: readiness.rpcUrl,
        indexerRpcUrl: readiness.indexerRpcUrl,
        providerAddress: readiness.providerAddress ?? null,
        inferenceServiceUrl: readiness.inferenceServiceUrl,
        readiness: {
          canUseReadOnlyBroker: readiness.canUseReadOnlyBroker,
          canUseAuthenticatedCompute: readiness.canUseAuthenticatedCompute,
          canUseDirectInference: readiness.canUseDirectInference,
          canUseStorageWrites: readiness.canUseStorageWrites,
          canPersistMemory: readiness.canPersistMemory,
          canRunFineTuning: readiness.canRunFineTuning
        },
        credentials: {
          privateKeyPresent: readiness.hasPrivateKey,
          providerAddressPresent: readiness.hasProviderAddress,
          inferenceApiKeyPresent: readiness.hasInferenceApiKey
        },
        docs: networkConfig.preflightDocs
      },
      null,
      2
    )
  );
}

async function handleOgProviders(options: OgProvidersOptions): Promise<void> {
  const limit = Number(options.limit);
  if (!Number.isFinite(limit) || limit < 1) {
    throw new Error('--limit must be a positive integer.');
  }

  const endpoints = resolveNetworkEndpoints(undefined, options.rpc, undefined);
  const result =
    options.service === 'fine-tuning'
      ? await listFineTuningServices(
          { rpcUrl: endpoints.rpcUrl },
          { includeUnacknowledged: options.includeUnacknowledged }
        )
      : await listInferenceServices(
          { rpcUrl: endpoints.rpcUrl },
          {
            detailed: options.detailed,
            includeUnacknowledged: options.includeUnacknowledged,
            limit
          }
        );

  console.log(JSON.stringify(result, null, 2));
}

async function handleOgFineTuneModels(options: { rpc: string }): Promise<void> {
  const endpoints = resolveNetworkEndpoints(undefined, options.rpc, undefined);
  const models = await listFineTuningModels({ rpcUrl: endpoints.rpcUrl });
  console.log(JSON.stringify(models, null, 2));
}

async function handleOgStorageUpload(options: OgStorageUploadOptions): Promise<void> {
  const endpoints = resolveNetworkEndpoints(options.network, options.rpc, options.indexerRpc);
  const filePath = resolveRepoOrAbsolutePath(options.file ?? discoverLatestDatasetPath());

  if (!existsSync(filePath)) {
    throw new Error(`Storage upload file not found: ${filePath}`);
  }

  const upload = await uploadFileToStorage(filePath, {
    network: options.network,
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl
  });

  const receipt = {
    uploadedAt: new Date().toISOString(),
    network: options.network ?? 'galileo',
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl,
    filePath,
    upload
  };

  const receiptPath = writeOgReceipt('storage-uploads', 'upload', receipt);
  console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2));
}

async function handleOgMemoryPush(options: OgMemoryPushOptions): Promise<void> {
  const endpoints = resolveNetworkEndpoints(options.network, options.rpc, options.indexerRpc);
  const filePath = resolveRepoOrAbsolutePath(options.file ?? discoverLatestMemorySnapshotPath());

  if (!existsSync(filePath)) {
    throw new Error(`Memory snapshot file not found: ${filePath}`);
  }

  const snapshot = JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const agentKey = options.agent ?? inferAgentKeyFromMemoryPath(filePath);
  const upload = await uploadAgentMemorySnapshot(agentKey, snapshot, {
    network: options.network,
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl
  });

  const receipt = {
    uploadedAt: new Date().toISOString(),
    network: options.network ?? 'galileo',
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl,
    agentKey,
    filePath,
    upload
  };

  const receiptPath = writeOgReceipt('memory', 'push', receipt);
  console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2));
}

async function handleOgMemoryPull(options: OgMemoryPullOptions): Promise<void> {
  const endpoints = resolveNetworkEndpoints(options.network, options.rpc, options.indexerRpc);
  const payload = await downloadAgentMemorySnapshot<Record<string, unknown>>(options.root, {
    network: options.network,
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl
  });

  const outputPath = resolvePullOutputPath(options.out, payload.agentKey, payload.capturedAt, options.root);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        rootHash: options.root,
        outputPath,
        ...payload
      },
      null,
      2
    )
  );
}

async function handleOgFineTuningCreateTask(options: OgFineTuningCreateTaskOptions): Promise<void> {
  const endpoints = resolveNetworkEndpoints(options.network, options.rpc, options.indexerRpc);
  const providerAddress = getAddress(options.provider);
  const trainingPath = resolveTrainingConfigPath(options.configPath);
  const gasPrice = parseOptionalNumber(options.gasPrice, '--gas-price');

  let datasetHash = options.datasetRootHash;
  let datasetPath: string | undefined;
  let datasetUpload: unknown;

  if (!datasetHash) {
    datasetPath = resolveRepoOrAbsolutePath(options.datasetPath ?? discoverLatestDatasetPath());
    const result = await createFineTuningTaskFromDatasetPath({
      network: options.network,
      rpcUrl: endpoints.rpcUrl,
      indexerRpcUrl: endpoints.indexerRpcUrl,
      providerAddress,
      baseModel: options.model,
      datasetPath,
      trainingPath,
      gasPrice
    });

    datasetUpload = result.datasetUpload;
    datasetHash = result.datasetUpload.rootHash ?? result.datasetUpload.rootHashes?.[0];

    const receipt = {
      createdAt: new Date().toISOString(),
      network: options.network ?? 'galileo',
      rpcUrl: endpoints.rpcUrl,
      indexerRpcUrl: endpoints.indexerRpcUrl,
      providerAddress,
      baseModel: options.model,
      datasetPath,
      datasetHash,
      trainingPath,
      datasetUpload,
      taskId: result.taskId
    };

    const receiptPath = writeOgReceipt('fine-tuning', 'create-task', receipt);
    console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2));
    return;
  }

  const taskId = await createFineTuningTask({
    network: options.network,
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl,
    providerAddress,
    baseModel: options.model,
    datasetHash,
    trainingPath,
    gasPrice
  });

  const receipt = {
    createdAt: new Date().toISOString(),
    network: options.network ?? 'galileo',
    rpcUrl: endpoints.rpcUrl,
    indexerRpcUrl: endpoints.indexerRpcUrl,
    providerAddress,
    baseModel: options.model,
    datasetHash,
    trainingPath,
    taskId
  };

  const receiptPath = writeOgReceipt('fine-tuning', 'create-task', receipt);
  console.log(JSON.stringify({ ...receipt, receiptPath }, null, 2));
}

async function handleOgFaucetClaim(options: OgFaucetClaimOptions): Promise<void> {
  const address = resolveAddress(options.address);
  const faucetUrl = getFaucetUrl(options.provider);
  const pollMs = Number(options.pollSeconds) * 1000;
  const timeoutMs = Number(options.timeoutSeconds) * 1000;
  const startedAt = new Date();
  const initialBalance = await getBalanceWei(address, options.rpc);

  console.log(`Address: ${address}`);
  console.log(`RPC: ${options.rpc}`);
  console.log(`Initial balance: ${formatEther(initialBalance)} 0G (${initialBalance} wei)`);
  console.log(`Faucet provider: ${options.provider}`);
  console.log(`Faucet URL: ${faucetUrl}`);

  if (options.provider === 'gcloud') {
    console.log('');
    console.log('Google Cloud faucet: no login required — just paste your wallet address and click "Get 0.1 Galileo OG".');
  } else {
    console.log('');
    console.log('Official faucet: requires an X (Twitter) account login before you can request tokens.');
    console.log('Tip: run `aegis og faucet claim --provider gcloud` to use the Google Cloud faucet instead (no login needed).');
  }

  if (options.open) {
    try {
      await openBrowser(faucetUrl);
    } catch {
      console.log('Could not auto-open the faucet URL; open it manually in your browser.');
    }
  }

  console.log(`Polling for a balance increase every ${options.pollSeconds}s for up to ${options.timeoutSeconds}s…`);

  let finalBalance = initialBalance;
  let success = false;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, pollMs));
    finalBalance = await getBalanceWei(address, options.rpc);

    if (finalBalance > initialBalance) {
      success = true;
      break;
    }
  }

  const completedAt = new Date();
  const delta = finalBalance - initialBalance;
  const receipt: FaucetReceipt = {
    address,
    rpcUrl: options.rpc,
    provider: options.provider,
    faucetUrl,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    initialBalanceWei: initialBalance.toString(),
    finalBalanceWei: finalBalance.toString(),
    deltaWei: delta.toString(),
    success
  };

  const receiptPath = join(getFaucetClaimsDir(), `${completedAt.toISOString().replace(/[:]/g, '-')}-${address}.json`);
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ ...receipt, receiptPath, finalBalance0G: formatEther(finalBalance), delta0G: formatEther(delta) }, null, 2));

  if (!success) {
    throw new Error(`No balance increase detected within ${options.timeoutSeconds} seconds. Complete the faucet flow in the browser, then retry or run \
\`aegis og balance --address ${address}\`.`);
  }
}

export function registerOgCommands(program: Command): void {
  const og = program.command('og').description('0G testnet helpers');
  const faucet = og.command('faucet').description('0G Galileo faucet helpers');
  const storage = og.command('storage').description('0G storage upload helpers');
  const memory = og.command('memory').description('0G agent memory snapshot helpers');
  const fineTuning = og.command('fine-tuning').description('0G fine-tuning helpers');

  og
    .command('balance')
    .description('Read the 0G balance for an address or the active session signer')
    .option('--address <address>', 'address to inspect; defaults to the active session signer')
    .option('--rpc <url>', 'RPC URL to query', galileoTestnet.rpcUrl)
    .action(async (options: OgBalanceOptions) => {
      await handleOgBalance(options);
    });

  og
    .command('status')
    .description('Summarize 0G SDK readiness for compute, storage, memory, and fine-tuning')
    .option('--rpc <url>', 'RPC URL to inspect', galileoTestnet.rpcUrl)
    .option('--indexer-rpc <url>', '0G storage indexer RPC URL')
    .option('--network <network>', 'network to target: galileo or mainnet')
    .option('--provider-address <address>', 'preferred provider address for inference or fine-tuning workflows')
    .action(async (options: OgStatusOptions) => {
      await handleOgStatus(options);
    });

  og
    .command('providers')
    .description('List registered 0G inference or fine-tuning services using the official read-only broker')
    .option('--rpc <url>', 'RPC URL to inspect', galileoTestnet.rpcUrl)
    .option('--service <service>', 'service class to inspect: inference or fine-tuning', 'inference')
    .option('--detailed', 'include health and model metadata for inference services')
    .option('--include-unacknowledged', 'include providers that are not yet acknowledged')
    .option('--limit <count>', 'maximum inference providers to inspect', '20')
    .action(async (options: OgProvidersOptions) => {
      await handleOgProviders(options);
    });

  og
    .command('fine-tune-models')
    .description('List standard and customized models exposed by the 0G fine-tuning broker')
    .option('--rpc <url>', 'RPC URL to inspect', galileoTestnet.rpcUrl)
    .action(async (options: { rpc: string }) => {
      await handleOgFineTuneModels(options);
    });

  storage
    .command('upload')
    .description('Upload a local file to 0G Storage; defaults to the latest repo JSONL dataset if found')
    .option('--file <path>', 'path to the file to upload')
    .option('--rpc <url>', 'RPC URL to use for storage writes', galileoTestnet.rpcUrl)
    .option('--indexer-rpc <url>', '0G storage indexer RPC URL', galileoTestnet.storage.indexerRpcUrl)
    .option('--network <network>', 'network to target: galileo or mainnet')
    .action(async (options: OgStorageUploadOptions) => {
      await handleOgStorageUpload(options);
    });

  memory
    .command('push')
    .description('Upload an agent memory snapshot JSON file to 0G Storage; defaults to the latest sim memory artifact if found')
    .option('--agent <key>', 'agent memory key; defaults to the memory snapshot filename stem')
    .option('--file <path>', 'path to a JSON memory snapshot file')
    .option('--rpc <url>', 'RPC URL to use for storage writes', galileoTestnet.rpcUrl)
    .option('--indexer-rpc <url>', '0G storage indexer RPC URL', galileoTestnet.storage.indexerRpcUrl)
    .option('--network <network>', 'network to target: galileo or mainnet')
    .action(async (options: OgMemoryPushOptions) => {
      await handleOgMemoryPush(options);
    });

  memory
    .command('pull')
    .description('Download a previously uploaded agent memory snapshot by 0G storage root hash')
    .requiredOption('--root <hash>', '0G storage root hash for the memory snapshot')
    .option('--out <path>', 'output file path; defaults to ~/.aegis-arena/og/memory-downloads/...')
    .option('--rpc <url>', 'RPC URL to use for the storage indexer', galileoTestnet.rpcUrl)
    .option('--indexer-rpc <url>', '0G storage indexer RPC URL', galileoTestnet.storage.indexerRpcUrl)
    .option('--network <network>', 'network to target: galileo or mainnet')
    .action(async (options: OgMemoryPullOptions) => {
      await handleOgMemoryPull(options);
    });

  fineTuning
    .command('create-task')
    .description('Upload an ETL dataset if needed and create a 0G fine-tuning task against a provider')
    .requiredOption('--provider <address>', 'fine-tuning provider address')
    .option('--model <model>', 'base model name', 'Qwen2.5-0.5B-Instruct')
    .option('--dataset-path <path>', 'local JSONL dataset path; defaults to the latest repo dataset if found')
    .option('--dataset-root-hash <hash>', 'existing 0G storage root hash for a pre-uploaded dataset')
    .option('--config-path <path>', 'training config path; defaults to a generated demo config under ~/.aegis-arena/og')
    .option('--rpc <url>', 'RPC URL to use for fine-tuning', galileoTestnet.rpcUrl)
    .option('--indexer-rpc <url>', '0G storage indexer RPC URL', galileoTestnet.storage.indexerRpcUrl)
    .option('--network <network>', 'network to target: galileo or mainnet')
    .option('--gas-price <value>', 'optional gas price override for the fine-tuning task')
    .action(async (options: OgFineTuningCreateTaskOptions) => {
      await handleOgFineTuningCreateTask(options);
    });

  og
    .command('detect-ledger')
    .description('Check whether a Ledger hardware wallet is connected over USB')
    .option('--wait', 'Wait up to 60 s for a device to appear')
    .action(async (options: { wait?: boolean }) => {
      if (options.wait) {
        await waitForLedgerDevice();
        console.log('Ledger device is connected. Unlock it and open the Ethereum app, then run `aegis login safe --mode ledger`.');
      } else {
        const connected = await isLedgerConnected();
        console.log(JSON.stringify({ connected }));
        if (connected) {
          console.log('Ledger device detected. Unlock it and open the Ethereum app, then run `aegis login safe --mode ledger`.');
        } else {
          console.log('No Ledger device detected. Plug in your Ledger over USB and try again.');
        }
      }
    });

  faucet
    .command('claim')
    .description('Open the Galileo faucet and verify that the requested address receives 0G tokens')
    .option('--address <address>', 'address to fund; defaults to the active session signer')
    .option('--rpc <url>', 'RPC URL used to poll for the post-claim balance', galileoTestnet.rpcUrl)
    .option(
      '--provider <provider>',
      'faucet provider: "gcloud" (Google Cloud, no login) or "official" (hub.0g.ai, requires X/Twitter login)',
      'gcloud'
    )
    .option('--no-open', 'Do not auto-open the faucet in the browser')
    .option('--poll-seconds <seconds>', 'seconds between balance checks', '5')
    .option('--timeout-seconds <seconds>', 'seconds to wait for a balance increase', '180')
    .action(async (options: OgFaucetClaimOptions) => {
      await handleOgFaucetClaim(options);
    });
}

function getOgArtifactsDir(segment: string): string {
  const dir = join(getAegisHome(), 'og', segment);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeOgReceipt(segment: string, prefix: string, payload: unknown): string {
  const timestamp = new Date().toISOString().replace(/[:]/g, '-');
  const filePath = join(getOgArtifactsDir(segment), `${timestamp}-${prefix}.json`);
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function resolveRepoOrAbsolutePath(input: string): string {
  return isAbsolute(input) ? input : resolve(repoRoot, input);
}

function resolveTrainingConfigPath(configPath?: string): string {
  if (configPath) {
    const resolved = resolveRepoOrAbsolutePath(configPath);
    if (!existsSync(resolved)) {
      throw new Error(`Training config file not found: ${resolved}`);
    }
    return resolved;
  }

  const generatedPath = join(getOgArtifactsDir('fine-tuning-configs'), 'training-config.default.json');
  if (!existsSync(generatedPath)) {
    writeFileSync(
      generatedPath,
      `${JSON.stringify(
        {
          neftune_noise_alpha: 5,
          num_train_epochs: 3,
          per_device_train_batch_size: 2,
          learning_rate: 0.0002,
          max_steps: 45
        },
        null,
        2
      )}\n`,
      'utf8'
    );
  }

  return generatedPath;
}

function resolvePullOutputPath(out: string | undefined, agentKey: string, capturedAt: string, rootHash: string): string {
  if (out) {
    return resolveRepoOrAbsolutePath(out);
  }

  const safeAgentKey = agentKey.replace(/[^a-z0-9_-]/gi, '-');
  const safeTimestamp = capturedAt.replace(/[:]/g, '-');
  const suffix = rootHash.slice(0, 10);
  return join(getOgArtifactsDir('memory-downloads'), `${safeTimestamp}-${safeAgentKey}-${suffix}.json`);
}

function discoverLatestDatasetPath(): string {
  const matches = [
    ...collectMatchingFiles(join(repoRoot, 'data'), (filePath) => /\.jsonl$/i.test(filePath)),
    ...collectMatchingFiles(join(repoRoot, 'runs'), (filePath) => /\.jsonl$/i.test(filePath))
  ];

  const latest = pickLatestFile(matches);
  if (!latest) {
    throw new Error('No local JSONL dataset found. Pass --file or --dataset-path explicitly.');
  }

  return latest;
}

function discoverLatestMemorySnapshotPath(): string {
  const matches = collectMatchingFiles(join(repoRoot, 'runs'), (filePath) => /\.memory\.json$/i.test(filePath));
  const latest = pickLatestFile(matches);

  if (!latest) {
    throw new Error('No simulation memory snapshot found. Pass --file with a JSON memory snapshot path.');
  }

  return latest;
}

function inferAgentKeyFromMemoryPath(filePath: string): string {
  const base = filePath.split('/').pop() ?? 'agent-memory';
  return base.replace(/\.memory\.json$/i, '').replace(/\.json$/i, '');
}

function collectMatchingFiles(rootPath: string, predicate: (filePath: string) => boolean): string[] {
  if (!existsSync(rootPath)) {
    return [];
  }

  const results: string[] = [];
  const entries = readdirSync(rootPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(rootPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMatchingFiles(fullPath, predicate));
      continue;
    }

    if (entry.isFile() && predicate(fullPath)) {
      results.push(fullPath);
    }
  }

  return results;
}

function pickLatestFile(paths: string[]): string | undefined {
  return paths
    .map((filePath) => ({ filePath, mtimeMs: statSync(filePath).mtimeMs }))
    .sort((left, right) => right.mtimeMs - left.mtimeMs)[0]?.filePath;
}

function parseOptionalNumber(value: string | undefined, flagName: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${flagName} must be a valid number.`);
  }

  return parsed;
}

function resolveNetworkEndpoints(
  network: OgNetwork | undefined,
  rpcUrl: string,
  indexerRpcUrl: string | undefined
): { rpcUrl: string; indexerRpcUrl: string } {
  const target = network === 'mainnet' ? mainnet : galileoTestnet;

  return {
    rpcUrl: rpcUrl === galileoTestnet.rpcUrl && network === 'mainnet' ? mainnet.rpcUrl : rpcUrl,
    indexerRpcUrl:
      indexerRpcUrl ?? (network === 'mainnet' ? mainnet.storage.indexerRpcUrl : galileoTestnet.storage.indexerRpcUrl)
  };
}