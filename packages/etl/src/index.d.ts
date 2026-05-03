export type EnrichmentSource = 'defillama' | 'github' | 'docs' | 'explorer' | 'manual';
export type ProtocolResource = {
    type: 'github' | 'docs' | 'explorer' | 'security-report' | 'frontend' | 'api';
    label: string;
    url: string;
    source: EnrichmentSource;
    confidence: 'low' | 'medium' | 'high';
};
export type ContractAddressRecord = {
    name: string;
    address: string;
    chain: string;
    category: 'core' | 'proxy' | 'oracle' | 'governance' | 'token' | 'treasury' | 'unknown';
    source: EnrichmentSource;
    verified: boolean;
    confidence: 'low' | 'medium' | 'high';
};
export type ProtocolInventory = {
    protocolSlug: string;
    protocolName: string;
    generatedAt: string;
    contractAddresses: ContractAddressRecord[];
    offchainResources: ProtocolResource[];
};
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
export type ModuleCheckInput = {
    blobConfigured: boolean;
    vectorDatabaseConfigured: boolean;
    rpcUrl?: string | null;
    generatedAt?: string;
};
export type FetchLike = typeof fetch;
export declare function fetchRekt2026Incidents(options?: {
    fetchImpl?: FetchLike;
    maxPages?: number;
}): Promise<RektIncidentRecord[]>;
export declare function fetchSoloditFindings(options?: {
    fetchImpl?: FetchLike;
    maxFindings?: number;
    maxSitemaps?: number;
}): Promise<SoloditFindingRecord[]>;
export declare function build0GModuleChecks(input: ModuleCheckInput): ModuleCheckRecord[];
//# sourceMappingURL=index.d.ts.map