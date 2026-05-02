import type {
  ServiceWithDetail,
  ZGComputeNetworkBroker,
  ZGComputeNetworkReadOnlyBroker
} from '@0gfoundation/0g-compute-ts-sdk';
import { Indexer, MemData, ZgFile } from '@0gfoundation/0g-storage-ts-sdk';
import { JsonRpcProvider, Wallet } from 'ethers';

type ComputeSdkModule = typeof import('@0gfoundation/0g-compute-ts-sdk');

let computeSdkPromise: Promise<ComputeSdkModule> | null = null;

async function loadComputeSdk(): Promise<ComputeSdkModule> {
  computeSdkPromise ??= import('@0gfoundation/0g-compute-ts-sdk');
  return computeSdkPromise;
}

export type AttestationMode = 'sealed-inference' | 'proof-of-inference' | 'mock';

export type OgNetwork = 'galileo' | 'mainnet';

export type OgNetworkConfig = {
  networkKey: OgNetwork;
  networkName: string;
  chainId: number;
  tokenSymbol: string;
  rpcUrl: string;
  explorerUrl: string;
  storageExplorerUrl: string;
  faucetUrl?: string;
  preflightDocs: string[];
  contracts: {
    ledger?: string;
    inference?: string;
    fineTuning?: string;
    storageFlow?: string;
    storageMine?: string;
    storageReward?: string;
    daEntrance?: string;
  };
  storage: {
    indexerRpcUrl: string;
    mode: 'turbo' | 'standard';
  };
  inference: {
    computeNetworkUrl: string;
    supportedModels: string[];
    attestationModes: AttestationMode[];
  };
};

export type OgRuntimeConfig = {
  network: OgNetwork;
  rpcUrl: string;
  indexerRpcUrl: string;
  privateKey?: string;
  providerAddress?: string;
  inferenceApiKey?: string;
  inferenceServiceUrl?: string;
  contractOverrides?: {
    ledgerCA?: string;
    inferenceCA?: string;
    fineTuningCA?: string;
  };
  gasPrice?: number;
  maxGasPrice?: number;
  step?: number;
};

export type OgRuntimeReadiness = {
  network: OgNetwork;
  rpcUrl: string;
  indexerRpcUrl: string;
  providerAddress?: string;
  inferenceServiceUrl?: string;
  hasPrivateKey: boolean;
  hasProviderAddress: boolean;
  hasInferenceApiKey: boolean;
  canUseReadOnlyBroker: boolean;
  canUseAuthenticatedCompute: boolean;
  canUseDirectInference: boolean;
  canUseStorageWrites: boolean;
  canPersistMemory: boolean;
  canRunFineTuning: boolean;
};

export type OgStorageUploadResult = {
  txHash?: string;
  rootHash?: string;
  txSeq?: number;
  txHashes?: string[];
  rootHashes?: string[];
  txSeqs?: number[];
};

export type OgStorageUploadConfig = Partial<OgRuntimeConfig> & {
  signer?: Wallet;
};

export type OgFineTuningTaskConfig = Partial<OgRuntimeConfig> & {
  signer?: Wallet;
  providerAddress: string;
  baseModel: string;
  datasetHash: string;
  trainingPath: string;
  gasPrice?: number;
};

export type OgFineTuningLocalTaskConfig = Partial<OgRuntimeConfig> & {
  signer?: Wallet;
  providerAddress: string;
  baseModel: string;
  datasetPath: string;
  trainingPath: string;
  gasPrice?: number;
};

export const galileoTestnet: OgNetworkConfig = {
  networkKey: 'galileo',
  networkName: '0G-Galileo-Testnet',
  chainId: 16602,
  tokenSymbol: '0G',
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  explorerUrl: 'https://chainscan-galileo.0g.ai',
  storageExplorerUrl: 'https://storagescan-galileo.0g.ai',
  faucetUrl: 'https://faucet.0g.ai',
  preflightDocs: ['https://build.0g.ai/sdks/', 'https://docs.0g.ai/developer-hub/testnet/testnet-overview'],
  contracts: {
    ledger: '0x70e1dD4B057B94b01D782c67b1A4B0F403277897',
    inference: '0x9A34fE4E3E29A6EB7e90b84b963E44591A58Ecc6',
    fineTuning: '0x58a9842553Dada1BE9741ceB916eD5b7119d510e',
    storageFlow: '0x22E03a6A89B950F1c82ec5e74F8eCa321a105296',
    storageMine: '0x00A9E9604b0538e06b268Fb297Df333337f9593b',
    storageReward: '0xA97B57b4BdFEA2D0a25e535bd849ad4e6C440A69',
    daEntrance: '0xE75A073dA5bb7b0eC622170Fd268f35E675a957B'
  },
  storage: {
    indexerRpcUrl: 'https://indexer-storage-testnet-turbo.0g.ai',
    mode: 'turbo'
  },
  inference: {
    computeNetworkUrl: 'https://compute.0g.ai',
    supportedModels: ['llama-3.3-70b-instruct', 'deepseek-r1-70b', 'glm-5-reasoning'],
    attestationModes: ['sealed-inference', 'proof-of-inference', 'mock']
  }
};

export const mainnet: OgNetworkConfig = {
  networkKey: 'mainnet',
  networkName: '0G Mainnet',
  chainId: 16661,
  tokenSymbol: '0G',
  rpcUrl: 'https://evmrpc.0g.ai',
  explorerUrl: 'https://chainscan.0g.ai',
  storageExplorerUrl: 'https://storagescan.0g.ai',
  preflightDocs: ['https://build.0g.ai/sdks/', 'https://docs.0g.ai/developer-hub/building-on-0g'],
  contracts: {},
  storage: {
    indexerRpcUrl: 'https://indexer-storage-turbo.0g.ai',
    mode: 'turbo'
  },
  inference: {
    computeNetworkUrl: 'https://compute.0g.ai',
    supportedModels: ['llama-3.3-70b-instruct', 'deepseek-r1-70b', 'glm-5-reasoning'],
    attestationModes: ['sealed-inference', 'proof-of-inference', 'mock']
  }
};

const networkMap: Record<OgNetwork, OgNetworkConfig> = {
  galileo: galileoTestnet,
  mainnet
};

export function getOgNetwork(network: OgNetwork = 'galileo'): OgNetworkConfig {
  return networkMap[network];
}

export function inferOgNetworkFromRpcUrl(rpcUrl?: string): OgNetwork {
  if (!rpcUrl) {
    return 'galileo';
  }

  if (/testnet|galileo/i.test(rpcUrl)) {
    return 'galileo';
  }

  if (/evmrpc\.0g\.ai|mainnet/i.test(rpcUrl)) {
    return 'mainnet';
  }

  return 'galileo';
}

export function resolveOgRuntimeConfig(overrides: Partial<OgRuntimeConfig> = {}): OgRuntimeConfig {
  const network = overrides.network ?? normalizeNetwork(process.env.AEGIS_OG_NETWORK) ?? inferOgNetworkFromRpcUrl(overrides.rpcUrl ?? process.env.AEGIS_OG_RPC_URL);
  const resolvedNetwork = getOgNetwork(network);

  return {
    network,
    rpcUrl: overrides.rpcUrl ?? process.env.AEGIS_OG_RPC_URL ?? resolvedNetwork.rpcUrl,
    indexerRpcUrl:
      overrides.indexerRpcUrl ?? process.env.AEGIS_OG_INDEXER_RPC_URL ?? resolvedNetwork.storage.indexerRpcUrl,
    privateKey: overrides.privateKey ?? process.env.AEGIS_OG_PRIVATE_KEY,
    providerAddress: overrides.providerAddress ?? process.env.AEGIS_OG_PROVIDER_ADDRESS,
    inferenceApiKey: overrides.inferenceApiKey ?? process.env.AEGIS_OG_INFERENCE_API_KEY,
    inferenceServiceUrl:
      overrides.inferenceServiceUrl ?? process.env.AEGIS_OG_INFERENCE_SERVICE_URL ?? resolvedNetwork.inference.computeNetworkUrl,
    contractOverrides: {
      ledgerCA: overrides.contractOverrides?.ledgerCA ?? process.env.AEGIS_OG_LEDGER_CA,
      inferenceCA: overrides.contractOverrides?.inferenceCA ?? process.env.AEGIS_OG_INFERENCE_CA,
      fineTuningCA: overrides.contractOverrides?.fineTuningCA ?? process.env.AEGIS_OG_FINE_TUNING_CA
    },
    gasPrice: overrides.gasPrice,
    maxGasPrice: overrides.maxGasPrice,
    step: overrides.step
  };
}

export function getOgRuntimeReadiness(overrides: Partial<OgRuntimeConfig> = {}): OgRuntimeReadiness {
  const runtime = resolveOgRuntimeConfig(overrides);

  return {
    network: runtime.network,
    rpcUrl: runtime.rpcUrl,
    indexerRpcUrl: runtime.indexerRpcUrl,
    providerAddress: runtime.providerAddress,
    inferenceServiceUrl: runtime.inferenceServiceUrl,
    hasPrivateKey: Boolean(runtime.privateKey),
    hasProviderAddress: Boolean(runtime.providerAddress),
    hasInferenceApiKey: Boolean(runtime.inferenceApiKey),
    canUseReadOnlyBroker: Boolean(runtime.rpcUrl),
    canUseAuthenticatedCompute: Boolean(runtime.rpcUrl && runtime.privateKey),
    canUseDirectInference: Boolean(runtime.inferenceServiceUrl),
    canUseStorageWrites: Boolean(runtime.rpcUrl && runtime.indexerRpcUrl && runtime.privateKey),
    canPersistMemory: Boolean(runtime.rpcUrl && runtime.indexerRpcUrl && runtime.privateKey),
    canRunFineTuning: Boolean(runtime.rpcUrl && runtime.privateKey && runtime.providerAddress)
  };
}

export function createOgWallet(overrides: Partial<OgRuntimeConfig> = {}): Wallet {
  const runtime = resolveOgRuntimeConfig(overrides);
  if (!runtime.privateKey) {
    throw new Error('Missing 0G private key. Set AEGIS_OG_PRIVATE_KEY or pass privateKey explicitly.');
  }

  const provider = new JsonRpcProvider(runtime.rpcUrl);
  return new Wallet(runtime.privateKey, provider);
}

export async function createOgComputeBroker(overrides: Partial<OgRuntimeConfig> = {}): Promise<ZGComputeNetworkBroker> {
  const runtime = resolveOgRuntimeConfig(overrides);
  const wallet = createOgWallet(runtime);
  const { createZGComputeNetworkBroker } = await loadComputeSdk();

  return createZGComputeNetworkBroker(
    wallet as never,
    runtime.contractOverrides?.ledgerCA,
    runtime.contractOverrides?.inferenceCA,
    runtime.contractOverrides?.fineTuningCA,
    runtime.gasPrice,
    runtime.maxGasPrice,
    runtime.step
  );
}

export async function createOgReadOnlyBroker(overrides: Partial<OgRuntimeConfig> = {}): Promise<ZGComputeNetworkReadOnlyBroker> {
  const runtime = resolveOgRuntimeConfig(overrides);
  const { createZGComputeNetworkReadOnlyBroker } = await loadComputeSdk();
  return createZGComputeNetworkReadOnlyBroker(runtime.rpcUrl, getOgNetwork(runtime.network).chainId);
}

export function createOgStorageIndexer(overrides: Partial<OgRuntimeConfig> = {}): Indexer {
  const runtime = resolveOgRuntimeConfig(overrides);
  return new Indexer(runtime.indexerRpcUrl);
}

export async function listInferenceServices(
  overrides: Partial<OgRuntimeConfig> = {},
  options: { detailed?: boolean; includeUnacknowledged?: boolean; offset?: number; limit?: number } = {}
): Promise<ServiceWithDetail[] | unknown[]> {
  const broker = await createOgReadOnlyBroker(overrides);
  if (options.detailed) {
    return broker.inference.listServiceWithDetail(options.offset ?? 0, options.limit ?? 50, options.includeUnacknowledged ?? false);
  }

  return broker.inference.listService(options.offset ?? 0, options.limit ?? 50, options.includeUnacknowledged ?? false);
}

export async function listFineTuningServices(
  overrides: Partial<OgRuntimeConfig> = {},
  options: { includeUnacknowledged?: boolean } = {}
): Promise<unknown[]> {
  const broker = await createOgReadOnlyBroker(overrides);
  return broker.fineTuning.listService(options.includeUnacknowledged ?? false);
}

export async function listFineTuningModels(
  overrides: Partial<OgRuntimeConfig> = {}
): Promise<[Array<[string, Record<string, string>]>, Array<[string, Record<string, string>]>]> {
  const broker = await createOgReadOnlyBroker(overrides);
  return broker.fineTuning.listModel() as Promise<[
    Array<[string, Record<string, string>]>,
    Array<[string, Record<string, string>]>
  ]>;
}

export async function uploadJsonToStorage<T>(
  value: T,
  config: OgStorageUploadConfig = {}
): Promise<OgStorageUploadResult> {
  const runtime = resolveOgRuntimeConfig(config);
  const signer = config.signer ?? createOgWallet(runtime);
  const indexer = createOgStorageIndexer(runtime);
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2));
  const file = new MemData(bytes);
  const [result, error] = await indexer.upload(
    file,
    runtime.rpcUrl,
    signer as unknown as Parameters<Indexer['upload']>[2]
  );

  if (error) {
    throw error;
  }

  return normalizeStorageUploadResult(result);
}

export async function uploadFileToStorage(
  filePath: string,
  config: OgStorageUploadConfig = {}
): Promise<OgStorageUploadResult> {
  const runtime = resolveOgRuntimeConfig(config);
  const signer = config.signer ?? createOgWallet(runtime);
  const indexer = createOgStorageIndexer(runtime);
  const file = await ZgFile.fromFilePath(filePath);

  try {
    const [result, error] = await indexer.upload(
      file,
      runtime.rpcUrl,
      signer as unknown as Parameters<Indexer['upload']>[2]
    );
    if (error) {
      throw error;
    }

    return normalizeStorageUploadResult(result);
  } finally {
    await file.close();
  }
}

export async function downloadJsonFromStorage<T>(
  rootHash: string | string[],
  config: Partial<OgRuntimeConfig> = {}
): Promise<T> {
  const indexer = createOgStorageIndexer(config);
  const [blob, error] = Array.isArray(rootHash)
    ? await indexer.downloadToBlob(rootHash, {})
    : await indexer.downloadToBlob(rootHash, {});

  if (error) {
    throw error;
  }

  const text = await blob.text();
  return JSON.parse(text) as T;
}

export async function downloadStorageRootToPath(
  rootHash: string | string[],
  outputPath: string,
  config: Partial<OgRuntimeConfig> = {}
): Promise<void> {
  const indexer = createOgStorageIndexer(config);
  const error = Array.isArray(rootHash)
    ? await indexer.download(rootHash, outputPath, false)
    : await indexer.download(rootHash, outputPath, false);
  if (error) {
    throw error;
  }
}

export async function uploadAgentMemorySnapshot(
  agentKey: string,
  snapshot: Record<string, unknown>,
  config: OgStorageUploadConfig = {}
): Promise<OgStorageUploadResult & { memoryKey: string }> {
  const result = await uploadJsonToStorage(
    {
      agentKey,
      capturedAt: new Date().toISOString(),
      snapshot
    },
    config
  );

  return {
    ...result,
    memoryKey: agentKey
  };
}

export async function downloadAgentMemorySnapshot<T extends Record<string, unknown>>(
  rootHash: string,
  config: Partial<OgRuntimeConfig> = {}
): Promise<{ agentKey: string; capturedAt: string; snapshot: T }> {
  return downloadJsonFromStorage<{ agentKey: string; capturedAt: string; snapshot: T }>(rootHash, config);
}

export async function createFineTuningTask(config: OgFineTuningTaskConfig): Promise<string> {
  const runtime = resolveOgRuntimeConfig(config);
  const broker = await createOgComputeBroker({
    ...runtime,
    gasPrice: config.gasPrice
  });

  if (!broker.fineTuning) {
    throw new Error('The authenticated 0G broker does not expose a fine-tuning surface for this signer.');
  }

  return broker.fineTuning.createTask(
    config.providerAddress,
    config.baseModel,
    config.datasetHash,
    config.trainingPath,
    config.gasPrice
  );
}

export async function createFineTuningTaskFromDatasetPath(
  config: OgFineTuningLocalTaskConfig
): Promise<{ taskId: string; datasetUpload: OgStorageUploadResult }> {
  const datasetUpload = await uploadFileToStorage(config.datasetPath, config);
  const datasetHash = firstRootHash(datasetUpload);

  if (!datasetHash) {
    throw new Error('Dataset upload completed but did not return a root hash.');
  }

  const taskId = await createFineTuningTask({
    ...config,
    datasetHash,
    trainingPath: config.trainingPath
  });

  return {
    taskId,
    datasetUpload
  };
}

export async function acknowledgeFineTunedModel(input: {
  providerAddress: string;
  taskId: string;
  dataPath: string;
  gasPrice?: number;
} & Partial<OgRuntimeConfig>): Promise<void> {
  const broker = await createOgComputeBroker(input);
  if (!broker.fineTuning) {
    throw new Error('The authenticated 0G broker does not expose a fine-tuning surface for this signer.');
  }

  await broker.fineTuning.acknowledgeModel(input.providerAddress, input.taskId, input.dataPath, {
    gasPrice: input.gasPrice
  });
}

export async function decryptFineTunedModel(input: {
  providerAddress: string;
  taskId: string;
  encryptedModelPath: string;
  decryptedModelPath: string;
} & Partial<OgRuntimeConfig>): Promise<void> {
  const broker = await createOgComputeBroker(input);
  if (!broker.fineTuning) {
    throw new Error('The authenticated 0G broker does not expose a fine-tuning surface for this signer.');
  }

  await broker.fineTuning.decryptModel(
    input.providerAddress,
    input.taskId,
    input.encryptedModelPath,
    input.decryptedModelPath
  );
}

function normalizeStorageUploadResult(result: unknown): OgStorageUploadResult {
  if (!result || typeof result !== 'object') {
    return {};
  }

  const value = result as Record<string, unknown>;
  return {
    txHash: typeof value.txHash === 'string' ? value.txHash : undefined,
    rootHash: typeof value.rootHash === 'string' ? value.rootHash : undefined,
    txSeq: typeof value.txSeq === 'number' ? value.txSeq : undefined,
    txHashes: Array.isArray(value.txHashes) ? (value.txHashes as string[]) : undefined,
    rootHashes: Array.isArray(value.rootHashes) ? (value.rootHashes as string[]) : undefined,
    txSeqs: Array.isArray(value.txSeqs) ? (value.txSeqs as number[]) : undefined
  };
}

function firstRootHash(result: OgStorageUploadResult): string | undefined {
  return result.rootHash ?? result.rootHashes?.[0];
}

function normalizeNetwork(value?: string): OgNetwork | undefined {
  if (!value) {
    return undefined;
  }

  if (/mainnet/i.test(value)) {
    return 'mainnet';
  }

  if (/galileo|testnet/i.test(value)) {
    return 'galileo';
  }

  return undefined;
}