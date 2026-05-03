import type { DashboardOverview, EtlJobRecord, VectorSpec } from '../../lib/types';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { formatDate } from '../../lib/utils';

export function PipelinePanel({ overview, jobs, spec }: { overview: DashboardOverview; jobs: EtlJobRecord[]; spec: VectorSpec }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Threat-intel ETL pipeline</CardTitle>
          <CardDescription>Vercel Functions materialize local telemetry plus Rekt News, Solodit, and 0G module-check datasets as append-friendly JSONL artifacts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-200">
            Use the freshest ETL findings to seed the next red-team prompt, then launch the scenario from the CLI workflow so the dashboard can monitor the result.
          </div>
          <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Storage backend</span><Badge>{overview.pipelineHealth.blobConfigured ? 'Vercel Blob' : 'Local filesystem'}</Badge></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Function shape</span><span>Route Handlers + cron</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">JSONL datasets</span><span>{jobs[0]?.datasets.length ?? 7} materialized views</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Vector provider</span><span>{spec.provider}</span></div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 font-medium">Cron entrypoint</div>
            <code className="block rounded-xl bg-black/40 p-3 text-xs text-cyan-300">GET /api/etl/run?source=cron</code>
            <p className="mt-3 text-muted-foreground">The cron job materializes protocol, simulation, epoch, agent-instance, Rekt incident, Solodit finding, and module-check datasets through the shared artifact store.</p>
          </div>
          <form action="/api/etl/run" method="post">
            <Button type="submit">Trigger ETL refresh</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent ETL jobs</CardTitle>
          <CardDescription>Each job records source, status, input/output counts, and emitted dataset paths.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {jobs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-muted-foreground">No ETL job has been executed yet. Trigger `/api/etl/run` or wait for the Vercel cron.</div>
          ) : (
            jobs.map((job) => (
              <div key={job.jobId} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-medium">{job.jobId}</div>
                  <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'warning' : 'secondary'}>{job.status}</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><span className="text-muted-foreground">Source:</span> {job.source}</div>
                  <div><span className="text-muted-foreground">Started:</span> {formatDate(job.startedAt)}</div>
                  <div><span className="text-muted-foreground">Input count:</span> {job.inputCount}</div>
                  <div><span className="text-muted-foreground">Output count:</span> {job.outputCount}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.datasets.map((dataset: EtlJobRecord['datasets'][number]) => (
                    <Badge key={dataset.path} variant="secondary">{dataset.name}: {dataset.recordCount}</Badge>
                  ))}
                </div>
                {job.error ? <p className="mt-3 text-danger">{job.error}</p> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </section>
  );
}
