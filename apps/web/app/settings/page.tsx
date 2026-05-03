import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { loadLatestPublishedCliSession } from '../../lib/server/auth';
import { env } from '../../lib/server/env';
import { galileoTestnet, getOgRuntimeReadiness, mainnet } from '../../lib/server/og';
import { buildOnChainActivity } from '../../lib/server/product-roadmap';
import { getVectorSpec } from '../../lib/server/vector';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await loadLatestPublishedCliSession();
  const spec = getVectorSpec();
  const sdkReadiness = getOgRuntimeReadiness({
    network: env.ogNetwork === 'mainnet' ? 'mainnet' : 'galileo',
    rpcUrl: session?.rpcUrl ?? env.ogRpcUrl,
    indexerRpcUrl: env.ogIndexerRpcUrl,
    privateKey: env.ogPrivateKey,
    providerAddress: env.ogProviderAddress,
    inferenceApiKey: env.ogInferenceApiKey,
    inferenceServiceUrl: env.ogInferenceServiceUrl
  });
  const activeNetwork = sdkReadiness.network === 'mainnet' ? mainnet : galileoTestnet;
  const onChainActivity = buildOnChainActivity(session?.safeAddress ?? null, session?.publishedAt);

  return (
    <div className="space-y-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>Runtime settings</CardTitle>
          <CardDescription>Deployment-facing configuration for session auth, storage, vector search, ETL persistence, and future settlement visibility.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="mb-2 font-medium">Session binding</div>
            <div className="text-muted-foreground">{session ? `${session.safeAddress} via ${session.mode}` : 'No published Safe session yet.'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="mb-2 font-medium">Artifact backend</div>
            <div className="text-muted-foreground">{env.blobConfigured ? 'Vercel Blob with overwrite-safe JSONL artifacts.' : 'Local filesystem fallback inside the repo data root.'}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="mb-2 font-medium">Vector provider</div>
            <div className="text-muted-foreground">{spec.provider} · {spec.embeddingModel} · {spec.dimension} dims</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="mb-2 font-medium">0G SDK target</div>
            <div className="text-muted-foreground">{activeNetwork.networkName} · chain {activeNetwork.chainId} · {sdkReadiness.indexerRpcUrl}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="mb-2 font-medium">On-chain visibility</div>
            <div className="text-muted-foreground">{onChainActivity.walletLabel}</div>
            <div className="mt-1 text-muted-foreground">{onChainActivity.paymentReference}</div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>Environment posture</CardTitle>
            <CardDescription>Only deploy-safe details that the control plane can infer directly from runtime state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between"><span className="text-muted-foreground">`DATABASE_URL`</span><Badge variant={env.databaseUrl ? 'success' : 'warning'}>{env.databaseUrl ? 'Present' : 'Missing'}</Badge></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between"><span className="text-muted-foreground">`BLOB_READ_WRITE_TOKEN`</span><Badge variant={env.blobConfigured ? 'success' : 'warning'}>{env.blobConfigured ? 'Present' : 'Missing'}</Badge></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between"><span className="text-muted-foreground">`AEGIS_OG_PRIVATE_KEY`</span><Badge variant={sdkReadiness.hasPrivateKey ? 'success' : 'warning'}>{sdkReadiness.hasPrivateKey ? 'Present' : 'Missing'}</Badge></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between"><span className="text-muted-foreground">`AEGIS_OG_PROVIDER_ADDRESS`</span><Badge variant={sdkReadiness.hasProviderAddress ? 'success' : 'warning'}>{sdkReadiness.hasProviderAddress ? 'Present' : 'Missing'}</Badge></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between"><span className="text-muted-foreground">`AEGIS_OG_INFERENCE_API_KEY`</span><Badge variant={sdkReadiness.hasInferenceApiKey ? 'success' : 'warning'}>{sdkReadiness.hasInferenceApiKey ? 'Present' : 'Missing'}</Badge></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between"><span className="text-muted-foreground">Vector dimension</span><span>{env.vectorDimension}</span></div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex items-center justify-between"><span className="text-muted-foreground">Embedding model</span><span>{env.embeddingModel}</span></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Storage layout</CardTitle>
            <CardDescription>Reference view for how the multi-page app stores telemetry and ETL artifacts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div>
              <div className="mb-2 font-medium">JSONL / Blob artifacts</div>
              <div className="flex flex-wrap gap-2">
                {spec.storageLayout.jsonlBlobs.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
              </div>
            </div>
            <div>
              <div className="mb-2 font-medium">Database surfaces</div>
              <div className="flex flex-wrap gap-2">
                {spec.storageLayout.database.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}
              </div>
            </div>
            <div>
              <div className="mb-2 font-medium">Guarantees</div>
              <div className="space-y-2">
                {spec.guarantees.map((guarantee) => (
                  <div key={guarantee} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-muted-foreground">{guarantee}</div>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 font-medium">0G SDK surfaces</div>
              <div className="space-y-2">
                {[
                  `Compute read-only broker: ${sdkReadiness.canUseReadOnlyBroker ? 'ready' : 'requires RPC'}`,
                  `Compute authenticated broker: ${sdkReadiness.canUseAuthenticatedCompute ? 'ready' : 'requires private key'}`,
                  `Storage and memory writes: ${sdkReadiness.canPersistMemory ? 'ready' : 'requires signer + indexer'}`,
                  `Fine-tuning task flow: ${sdkReadiness.canRunFineTuning ? 'ready' : 'requires provider address'}`
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-muted-foreground">{item}</div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
