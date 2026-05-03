import { Activity, BrainCircuit, DatabaseZap, ShieldCheck } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Card, CardContent } from '../ui/card';
import type { DashboardOverview } from '../../lib/types';
import { formatDate } from '../../lib/utils';

const highlights = [
  {
    icon: ShieldCheck,
    title: 'Wallet-first CLI onboarding',
    description: 'Browser wallet, Ledger, and Privy-backed flows can bind an operator identity before the web app takes over as mission control.'
  },
  {
    icon: Activity,
    title: 'Mission-control run telemetry',
    description: 'Dashboards aggregate current inventory, real simulation manifests, and the derived run/operator metadata needed for live demos.'
  },
  {
    icon: DatabaseZap,
    title: 'Blob + JSONL ETL artifacts',
    description: 'ETL jobs emit append-friendly datasets that can seed the next red-team prompt from current exploit intelligence.'
  },
  {
    icon: BrainCircuit,
    title: 'Per-user vector memory',
    description: 'Each wallet-linked user gets isolated namespaces for protocol notes, RLHF feedback, replay memory, and future fine-tuning inputs.'
  }
];

export function Hero({ overview }: { overview: DashboardOverview }) {
  return (
    <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
      <Card className="overflow-hidden">
        <CardContent className="relative p-8">
          <div className="absolute inset-0 bg-grid bg-[size:32px_32px] opacity-20" />
          <div className="relative space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>0G + Vercel control plane</Badge>
              <Badge variant="secondary">Generated {formatDate(overview.generatedAt)}</Badge>
              <Badge variant={overview.pipelineHealth.vectorDbConfigured ? 'success' : 'warning'}>
                {overview.pipelineHealth.vectorDbConfigured ? 'Vector DB online' : 'Local vector mode'}
              </Badge>
            </div>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Mission control for wallet-native red teaming, live threat intel, and 0G-aligned agent operations.
              </h1>
              <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                This web app is wired to the same protocol inventories, simulation runs, wallet session model, and replay-feedback surfaces that power the CLI.
                It separates dashboard, ETL, module validation, roadmap, and settings workflows while keeping the deployment path Vercel-native: Functions, Blob, JSONL, and pgvector.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {highlights.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h2 className="font-medium">{item.title}</h2>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-4 p-8">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Current identity context</p>
            <h2 className="mt-2 text-2xl font-semibold">{overview.session?.safeAddress ?? 'No published wallet session yet'}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {overview.session
                ? `Signer ${overview.session.signerAddress} authenticated via ${overview.session.mode}.`
                : 'Run aegis login wallet, then publish the session to this web backend to bind a user dashboard context.'}
            </p>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Verified owner</span><span>{overview.session?.verifiedOwner ? 'Yes' : 'Pending'}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">RPC target</span><span>{overview.session?.rpcUrl ?? '0G Galileo testnet'}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Vector dimension</span><span>{overview.pipelineHealth.vectorDimension}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Blob storage</span><span>{overview.pipelineHealth.blobConfigured ? 'Configured' : 'Local fallback'}</span></div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
