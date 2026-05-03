import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { loadLatestPublishedCliSession } from '../../lib/server/auth';
import { env } from '../../lib/server/env';
import { galileoTestnet, getOgRuntimeReadiness, mainnet } from '../../lib/server/og';
import { build0GModuleChecks } from '../../lib/server/threat-intel';

export const dynamic = 'force-dynamic';

function statusVariant(status: ReturnType<typeof build0GModuleChecks>[number]['status']) {
  if (status === 'ready') return 'success' as const;
  if (status === 'attention') return 'warning' as const;
  if (status === 'planned') return 'default' as const;
  return 'secondary' as const;
}

export default async function ModulesPage() {
  const session = await loadLatestPublishedCliSession();
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
  const checks = build0GModuleChecks({
    blobConfigured: env.blobConfigured,
    vectorDatabaseConfigured: Boolean(env.databaseUrl),
    rpcUrl: sdkReadiness.rpcUrl,
    generatedAt: new Date().toISOString()
  });

  return (
    <div className="space-y-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>0G execution posture</CardTitle>
          <CardDescription>Inference status, authenticated compute readiness, storage posture, fine-tuning direction, alignment concepts, and operator-memory signals derived from the 0G stack.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {checks.map((check) => (
            <div key={check.moduleId} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{check.name}</div>
                  <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{check.area}</div>
                </div>
                <Badge variant={statusVariant(check.status)}>{check.status}</Badge>
              </div>
              <p className="text-muted-foreground">{check.summary}</p>
              <p className="mt-3 text-xs text-muted-foreground">{check.detail}</p>
              <div className="mt-3 text-xs text-cyan-300">{check.sourceUrl}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Operator task list</CardTitle>
            <CardDescription>High-value follow-through items for the multi-agent 0G stack and the next wave of mission-control features.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              'Bind Galileo RPC or Safe session before live agent orchestration.',
              'Route attacker, defender, and judge inference through a consistent model gateway.',
              'Mirror the JSONL ETL artifacts into 0G storage once dataset retention grows.',
              'Promote replay and ETL narratives into fine-tuning or preference datasets.',
              'Keep vector search persistent so agent memory remains explainable across runs.'
            ].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-muted-foreground">{item}</div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Inference status</CardTitle>
            <CardDescription>Current 0G SDK readiness for read-only browsing, authenticated compute, storage writes, memory persistence, and future fine-tuning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Active network</span><span>{activeNetwork.networkName}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Read-only broker</span><span>{sdkReadiness.canUseReadOnlyBroker ? 'Ready' : 'Missing RPC'}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Authenticated compute</span><span>{sdkReadiness.canUseAuthenticatedCompute ? 'Ready' : 'Missing wallet'}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Storage + memory writes</span><span>{sdkReadiness.canPersistMemory ? 'Ready' : 'Missing signer or indexer'}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Fine-tuning</span><span>{sdkReadiness.canRunFineTuning ? 'Ready' : 'Provider binding needed'}</span></div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between"><span className="text-muted-foreground">Indexer RPC</span><span>{sdkReadiness.indexerRpcUrl}</span></div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
