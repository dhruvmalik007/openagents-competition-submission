import Link from 'next/link';
import type { Route } from 'next';
import { ArrowRight, Bot, DatabaseZap, Settings2 } from 'lucide-react';
import { Hero } from '../../components/dashboard/hero';
import { MetricCards } from '../../components/dashboard/metric-cards';
import { ChartsPanel } from '../../components/dashboard/charts-panel';
import { ProtocolTable } from '../../components/dashboard/protocol-table';
import { RunTable } from '../../components/dashboard/run-table';
import { AuthAndVector } from '../../components/dashboard/auth-and-vector';
import { PipelinePanel } from '../../components/dashboard/pipeline-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { getDashboardSnapshot } from '../../lib/server/dashboard';
import { listEtlJobs } from '../../lib/server/etl';
import { getVectorSpec } from '../../lib/server/vector';

export const dynamic = 'force-dynamic';

const quickLinks: Array<{ href: string; title: string; description: string; icon: typeof DatabaseZap }> = [
  {
    href: '/etl',
    title: 'Threat-intel ETL',
    description: 'Review Rekt 2026 ingestion, Solodit findings, and artifact job history.',
    icon: DatabaseZap
  },
  {
    href: '/modules',
    title: '0G module checks',
    description: 'Track Galileo connectivity, inference readiness, and storage follow-through.',
    icon: Bot
  },
  {
    href: '/settings',
    title: 'Runtime settings',
    description: 'Inspect storage, vector, Safe-session, and deployment-level configuration.',
    icon: Settings2
  }
];

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();
  const jobs = await listEtlJobs();
  const spec = getVectorSpec();

  return (
    <div className="space-y-6 pb-8">
      <section className="grid gap-4 lg:grid-cols-3">
        {quickLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href as Route} className="block">
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex h-full flex-col justify-between gap-4 p-6">
                  <div className="space-y-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{item.title}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-primary">
                    Open page
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </section>

      <Hero overview={snapshot.overview} />
      <MetricCards overview={snapshot.overview} />
      <ChartsPanel overview={snapshot.overview} timeseries={snapshot.timeseries} />
      <PipelinePanel overview={snapshot.overview} jobs={jobs} spec={spec} />
      <AuthAndVector overview={snapshot.overview} spec={spec} />
      <ProtocolTable protocols={snapshot.protocols} />
      <RunTable runs={snapshot.runs.slice(0, 12)} />

      <Card>
        <CardHeader>
          <CardTitle>Why this is split now</CardTitle>
          <CardDescription>The control plane keeps the original telemetry views, but operational tasks now live on dedicated pages instead of one long dashboard.</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
