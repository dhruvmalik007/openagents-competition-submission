import type { ModuleCheckRecord, RektIncidentRecord, SoloditFindingRecord } from '../types';

export type ModuleCheckInput = {
  blobConfigured: boolean;
  vectorDatabaseConfigured: boolean;
  rpcUrl?: string | null;
  generatedAt?: string;
};

const REKT_BASE_URL = 'https://rekt.news';
const SOLODIT_BASE_URL = 'https://solodit.cyfrin.io';
const SOLODIT_SITEMAP_INDEX = `${SOLODIT_BASE_URL}/sitemap.xml`;
const REKT_LISTING_PATTERN = /<article class="post[^\"]*">([\s\S]*?)<\/article>/g;
const TITLE_PATTERN = /<h5 class="post-title(?: featured)?"><a href="([^"]+)">\s*(?:<!-- -->)?\s*([^<]+)<\/a>/;
const TIME_PATTERN = /<time>([^<]+)<\/time>/;
const EXCERPT_PATTERN = /<section class="post-excerpt"><p>([\s\S]*?)<\/p>/;
const TAG_PATTERN = /<span><a href="[^"]+">([^<]+)<\/a><\/span>/g;
const META_DESCRIPTION_PATTERN = /<meta(?: name="description"| property="og:description") content="([^"]+)"/;
const ETHERSCAN_TX_PATTERN = /https:\/\/etherscan\.io\/tx\/(0x[a-fA-F0-9]+)/g;
const ETHERSCAN_ADDRESS_PATTERN = /https:\/\/etherscan\.io\/address\/(0x[a-fA-F0-9]{40})/g;
const HTML_ENTITY_PATTERN = /&(#x?[0-9a-fA-F]+|amp|quot|apos|lt|gt);/g;
const HTML_TAG_PATTERN = /<[^>]+>/g;

const htmlEntityMap: Record<string, string> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>'
};

const knownChains = ['Ethereum', 'Base', 'Sui', 'Solana', 'BSC', 'Arbitrum', 'Optimism', 'Polygon', 'Avalanche', 'NEAR'];
const providerHints = new Set(['code4rena', 'sherlock', 'cantina', 'hacken', 'cyfrin', 'pashov', 'peckshield', 'trailofbits']);
const trailingTokens = new Set(['contest', 'git', 'audit', 'audits', 'report', 'reports', 'finding', 'findings', 'public']);
const uppercaseTokens = new Set(['amm', 'api', 'aum', 'dex', 'dprk', 'erc20', 'erc721', 'eth', 'evm', 'gas', 'io', 'kpi', 'l2', 'mev', 'mmr', 'nft', 'rpc', 'sdk', 'tvl', 'twap', 'usd', 'usr', 'wbtc']);

function decodeHtmlEntities(value: string): string {
  return value.replace(HTML_ENTITY_PATTERN, (_match, entity: string) => {
    if (entity in htmlEntityMap) {
      return htmlEntityMap[entity];
    }

    if (entity.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
    }

    if (entity.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
    }

    return entity;
  });
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function stripTags(value: string): string {
  return value.replace(HTML_TAG_PATTERN, ' ');
}

function textFromHtml(value: string | undefined): string {
  return normalizeWhitespace(decodeHtmlEntities(stripTags(value ?? '')));
}

function toAbsoluteUrl(baseUrl: string, path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return new URL(path, baseUrl).toString();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'AegisArenaThreatIntelBot/1.0 (+https://vercel.com)'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function parseUsdEstimate(value: string): number | null {
  const match = value.match(/\$([\d,.]+)\s*(million|billion|thousand|m|b|k)?/i);
  if (!match) {
    return null;
  }

  const amount = Number.parseFloat(match[1].replace(/,/g, ''));
  if (!Number.isFinite(amount)) {
    return null;
  }

  const suffix = match[2]?.toLowerCase();
  if (suffix === 'billion' || suffix === 'b') return amount * 1_000_000_000;
  if (suffix === 'million' || suffix === 'm') return amount * 1_000_000;
  if (suffix === 'thousand' || suffix === 'k') return amount * 1_000;
  return amount;
}

function detectChains(input: string): string[] {
  const haystack = input.toLowerCase();
  return knownChains.filter((chain) => haystack.includes(chain.toLowerCase()));
}

function slugFromUrl(url: string): string {
  return url.replace(/\/$/, '').split('/').pop() ?? url;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function formatToken(token: string): string {
  if (uppercaseTokens.has(token.toLowerCase()) || /^[a-z]?\d+$/i.test(token)) {
    return token.toUpperCase();
  }

  return token.charAt(0).toUpperCase() + token.slice(1);
}

function dedupeAdjacent(values: string[]): string[] {
  return values.filter((value, index) => index === 0 || value !== values[index - 1]);
}

type RektListingCard = {
  slug: string;
  title: string;
  protocolName: string;
  sourceUrl: string;
  publishedAt: string;
  excerpt: string;
  tags: string[];
  exploitType: string | null;
};

function parseRektListing(html: string): RektListingCard[] {
  const cards: RektListingCard[] = [];

  for (const match of html.matchAll(REKT_LISTING_PATTERN)) {
    const articleHtml = match[1];
    const titleMatch = articleHtml.match(TITLE_PATTERN);
    const timeMatch = articleHtml.match(TIME_PATTERN);

    if (!titleMatch || !timeMatch || !timeMatch[1].includes('2026')) {
      continue;
    }

    const tags = Array.from(articleHtml.matchAll(TAG_PATTERN)).map((entry) => textFromHtml(entry[1]));
    const title = textFromHtml(titleMatch[2]);
    if (!tags.some((tag) => /rekt/i.test(tag)) && !/rekt/i.test(title)) {
      continue;
    }

    const protocolName = tags[0] ?? title.split(' - ')[0] ?? title;
    const exploitType = tags.find((tag) => tag !== protocolName && !/rekt/i.test(tag)) ?? null;
    const excerptMatch = articleHtml.match(EXCERPT_PATTERN);

    cards.push({
      slug: slugFromUrl(titleMatch[1]),
      title,
      protocolName,
      sourceUrl: toAbsoluteUrl(REKT_BASE_URL, titleMatch[1]),
      publishedAt: new Date(timeMatch[1]).toISOString(),
      excerpt: textFromHtml(excerptMatch?.[1] ?? ''),
      tags,
      exploitType
    });
  }

  return cards;
}

async function fetchRektIncident(card: RektListingCard): Promise<RektIncidentRecord> {
  const html = await fetchText(card.sourceUrl);
  const timeMatch = html.match(TIME_PATTERN);
  const descriptionMatch = html.match(META_DESCRIPTION_PATTERN);
  const summary = textFromHtml(descriptionMatch?.[1]).replace(/^DeFi\s*\/\s*Crypto\s*-\s*/i, '');
  const attackTransactions = unique(Array.from(html.matchAll(ETHERSCAN_TX_PATTERN)).map((match) => `https://etherscan.io/tx/${match[1]}`));
  const involvedAddresses = unique(Array.from(html.matchAll(ETHERSCAN_ADDRESS_PATTERN)).map((match) => `https://etherscan.io/address/${match[1]}`));
  const bodyText = `${summary} ${card.excerpt} ${card.tags.join(' ')}`;

  return {
    incidentId: card.slug,
    slug: card.slug,
    title: card.title,
    protocolName: card.protocolName,
    sourceUrl: card.sourceUrl,
    publishedAt: timeMatch ? new Date(timeMatch[1]).toISOString() : card.publishedAt,
    summary: summary || card.excerpt,
    excerpt: card.excerpt,
    exploitType: card.exploitType,
    tags: card.tags,
    lossEstimateUsd: parseUsdEstimate(summary || card.excerpt),
    chains: detectChains(bodyText),
    attackTransactions,
    involvedAddresses,
    confidence: attackTransactions.length > 0 || involvedAddresses.length > 0 ? 'high' : 'medium'
  };
}

export async function fetchRekt2026Incidents(maxPages = 6): Promise<RektIncidentRecord[]> {
  const cardsBySlug = new Map<string, RektListingCard>();

  for (let page = 0; page < maxPages; page += 1) {
    const url = page === 0 ? `${REKT_BASE_URL}/?tag=REKT` : `${REKT_BASE_URL}/?tag=REKT&page=${page}`;
    const html = await fetchText(url);
    const cards = parseRektListing(html);

    if (cards.length === 0 && cardsBySlug.size > 0) {
      break;
    }

    for (const card of cards) {
      cardsBySlug.set(card.slug, card);
    }
  }

  const incidents = await Promise.all(Array.from(cardsBySlug.values()).map((card) => fetchRektIncident(card)));
  return incidents.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

function extractLocs(xml: string): string[] {
  return Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map((match) => decodeHtmlEntities(match[1]));
}

function extractIssueLocs(xml: string, maxCount: number): string[] {
  if (maxCount <= 0) {
    return [];
  }

  const matches: string[] = [];
  const regex = /<loc>([^<]+)<\/loc>/g;
  let entry: RegExpExecArray | null;

  while ((entry = regex.exec(xml)) && matches.length < maxCount) {
    const url = decodeHtmlEntities(entry[1]);
    if (url.includes('/issues/')) {
      matches.push(url);
    }
  }

  return matches;
}

function parseSoloditSeverity(slug: string): SoloditFindingRecord['severity'] {
  if (slug.startsWith('c-')) return 'critical';
  if (slug.startsWith('h-')) return 'high';
  if (slug.startsWith('m-')) return 'medium';
  if (slug.startsWith('l-')) return 'low';
  if (slug.startsWith('g-')) return 'gas';
  if (slug.startsWith('i-')) return 'informational';
  return 'unknown';
}

function inferSoloditMetadata(slug: string): { title: string; protocolHint: string | null; reportLabel: string | null; parserConfidence: 'low' | 'medium' } {
  const normalized = slug.replace(/^(?:c|h|m|l|g|i)-\d+-/, '');
  const tokens = normalized.split('-').filter(Boolean);
  const providerIndex = tokens.findIndex((token) => providerHints.has(token.toLowerCase()));
  const titleTokens = dedupeAdjacent((providerIndex === -1 ? tokens : tokens.slice(0, providerIndex)).filter((token) => !trailingTokens.has(token.toLowerCase())));
  const protocolTokens = providerIndex === -1 ? [] : dedupeAdjacent(tokens.slice(providerIndex + 1).filter((token) => !trailingTokens.has(token.toLowerCase())));
  const protocolHint = protocolTokens.length > 0 ? protocolTokens.slice(0, 2).map(formatToken).join(' ') : null;
  const reportLabel = providerIndex === -1 ? null : [formatToken(tokens[providerIndex]), protocolHint].filter(Boolean).join(' · ');

  return {
    title: titleTokens.map(formatToken).join(' '),
    protocolHint,
    reportLabel,
    parserConfidence: protocolHint || reportLabel ? 'medium' : 'low'
  };
}

export async function fetchSoloditFindings(options: { maxFindings?: number; maxSitemaps?: number } = {}): Promise<SoloditFindingRecord[]> {
  const maxFindings = options.maxFindings ?? 2500;
  const maxSitemaps = options.maxSitemaps ?? 8;
  const sitemapIndex = await fetchText(SOLODIT_SITEMAP_INDEX);
  const sitemaps = extractLocs(sitemapIndex)
    .filter((url) => url.includes('sitemap_'))
    .slice(0, maxSitemaps);

  const urlSet = new Set<string>();
  for (const sitemapUrl of sitemaps) {
    if (urlSet.size >= maxFindings) {
      break;
    }

    const payload = await fetchText(sitemapUrl);
    const remaining = maxFindings - urlSet.size;
    const issueUrls = extractIssueLocs(payload, remaining);
    for (const issueUrl of issueUrls) {
      if (urlSet.size >= maxFindings) {
        break;
      }
      urlSet.add(issueUrl);
    }
  }

  const urls = unique(Array.from(urlSet));
  const discoveredAt = new Date().toISOString();

  return urls
    .map((url) => {
      const slug = slugFromUrl(url);
      const metadata = inferSoloditMetadata(slug);
      return {
        findingId: slug,
        slug,
        title: metadata.title,
        severity: parseSoloditSeverity(slug),
        sourceUrl: url,
        source: 'solodit-sitemap' as const,
        reportLabel: metadata.reportLabel,
        protocolHint: metadata.protocolHint,
        discoveredAt,
        parserConfidence: metadata.parserConfidence
      };
    })
    .sort((left, right) => left.slug.localeCompare(right.slug));
}

export function build0GModuleChecks(input: ModuleCheckInput): ModuleCheckRecord[] {
  const updatedAt = input.generatedAt ?? new Date().toISOString();
  const rpcUrl = input.rpcUrl?.trim() ?? '';
  const galileoConnected = /0g|galileo/i.test(rpcUrl);

  return [
    {
      moduleId: 'galileo-network',
      name: 'Galileo testnet connectivity',
      area: 'network',
      status: galileoConnected ? 'ready' : rpcUrl ? 'attention' : 'planned',
      summary: galileoConnected ? 'CLI session targets a 0G/Galileo-compatible RPC endpoint.' : 'Bind a Safe session or RPC target for 0G Galileo operations.',
      detail: galileoConnected ? `Current RPC: ${rpcUrl}` : '0G recommends Galileo as the testnet entry point for dApps and modular AI workloads.',
      sourceUrl: 'https://0g.ai/blog/introducing-v3-testnet-galileo',
      updatedAt
    },
    {
      moduleId: 'inference-sdk',
      name: 'Inference integration surface',
      area: 'inference',
      status: 'planned',
      summary: 'Inference endpoints should back attacker, defender, and judge behaviors.',
      detail: '0G exposes an inference layer for application-side AI execution; wire model routing and auth before production traffic.',
      sourceUrl: 'https://docs.0g.ai/',
      updatedAt
    },
    {
      moduleId: 'storage-sdk',
      name: 'Structured dataset archival',
      area: 'storage',
      status: input.blobConfigured ? 'attention' : 'planned',
      summary: input.blobConfigured ? 'Blob archival is live; 0G storage mirroring remains the next step.' : 'Persist ETL outputs first, then mirror large datasets into the 0G storage path.',
      detail: 'The control plane is already JSONL/Blob-compatible, which is the right staging format before 0G storage SDK ingestion.',
      sourceUrl: 'https://docs.0g.ai/',
      updatedAt
    },
    {
      moduleId: 'fine-tuning',
      name: 'Policy fine-tuning workflow',
      area: 'training',
      status: 'planned',
      summary: 'Replay and ETL artifacts are ready to become supervised or preference-tuning corpora.',
      detail: 'Use run telemetry, exploit narratives, and RLHF feedback as the seed dataset for 0G fine-tuning tools.',
      sourceUrl: 'https://docs.0g.ai/',
      updatedAt
    },
    {
      moduleId: 'alignment-node',
      name: 'AI Alignment Node readiness',
      area: 'alignment',
      status: 'optional',
      summary: 'Alignment-node operations are optional for this control plane but should remain visible to operators.',
      detail: 'Track whether governance wants additional verification or alignment workflows around inference outputs.',
      sourceUrl: 'https://docs.0g.ai/',
      updatedAt
    },
    {
      moduleId: 'vector-and-ops',
      name: 'Operator memory and analytics',
      area: 'ops',
      status: input.vectorDatabaseConfigured ? 'ready' : 'attention',
      summary: input.vectorDatabaseConfigured ? 'Vector analytics is online for agent memory and ETL fragments.' : 'Local vector mode is active; upgrade to Neon/pgvector for persistent multi-user search.',
      detail: 'This check keeps the 0G-facing agent stack tied to retrieval quality, auditability, and operator feedback loops.',
      sourceUrl: 'https://docs.0g.ai/',
      updatedAt
    }
  ];
}
