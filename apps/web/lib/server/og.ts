export type OgWebNetwork = 'galileo' | 'mainnet';

export type OgWebNetworkConfig = {
  networkKey: OgWebNetwork;
  networkName: string;
  chainId: number;
  rpcUrl: string;
  indexerRpcUrl: string;
};

export type OgWebRuntimeReadiness = {
  network: OgWebNetwork;
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
  canPersistMemory: boolean;
  canRunFineTuning: boolean;
};

export const galileoTestnet: OgWebNetworkConfig = {
  networkKey: 'galileo',
  networkName: '0G-Galileo-Testnet',
  chainId: 16602,
  rpcUrl: 'https://evmrpc-testnet.0g.ai',
  indexerRpcUrl: 'https://indexer-storage-testnet-turbo.0g.ai'
};

export const mainnet: OgWebNetworkConfig = {
  networkKey: 'mainnet',
  networkName: '0G Mainnet',
  chainId: 16661,
  rpcUrl: 'https://evmrpc.0g.ai',
  indexerRpcUrl: 'https://indexer-storage-turbo.0g.ai'
};

export function getOgRuntimeReadiness(input: {
  network?: OgWebNetwork;
  rpcUrl?: string;
  indexerRpcUrl?: string;
  privateKey?: string;
  providerAddress?: string;
  inferenceApiKey?: string;
  inferenceServiceUrl?: string;
}): OgWebRuntimeReadiness {
  const network = input.network ?? inferNetworkFromRpc(input.rpcUrl);
  const base = network === 'mainnet' ? mainnet : galileoTestnet;
  const rpcUrl = input.rpcUrl ?? base.rpcUrl;
  const indexerRpcUrl = input.indexerRpcUrl ?? base.indexerRpcUrl;

  return {
    network,
    rpcUrl,
    indexerRpcUrl,
    providerAddress: input.providerAddress,
    inferenceServiceUrl: input.inferenceServiceUrl,
    hasPrivateKey: Boolean(input.privateKey),
    hasProviderAddress: Boolean(input.providerAddress),
    hasInferenceApiKey: Boolean(input.inferenceApiKey),
    canUseReadOnlyBroker: Boolean(rpcUrl),
    canUseAuthenticatedCompute: Boolean(rpcUrl && input.privateKey),
    canUseDirectInference: Boolean(input.inferenceServiceUrl),
    canPersistMemory: Boolean(rpcUrl && indexerRpcUrl && input.privateKey),
    canRunFineTuning: Boolean(rpcUrl && input.privateKey && input.providerAddress)
  };
}

function inferNetworkFromRpc(rpcUrl?: string): OgWebNetwork {
  if (!rpcUrl) {
    return 'galileo';
  }

  if (/mainnet|evmrpc\.0g\.ai/i.test(rpcUrl) && !/testnet/i.test(rpcUrl)) {
    return 'mainnet';
  }

  return 'galileo';
}