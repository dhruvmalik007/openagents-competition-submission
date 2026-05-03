import { AlertTriangle, DatabaseZap, Newspaper, ShieldAlert } from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import type { RektIncidentRecord, SoloditFindingRecord } from '../../lib/types';
import { listEtlJobs, readDatasetRecords } from '../../lib/server/etl';
import { fetchRekt2026Incidents, fetchSoloditFindings } from '../../lib/server/threat-intel';
import { formatDate, formatNumber } from '../../lib/utils';

export const dynamic = 'force-dynamic';

function severityVariant(severity: SoloditFindingRecord['severity']) {
  if (severity === 'critical' || severity === 'high') return 'warning' as const;
  if (severity === 'medium') return 'default' as const;
  return 'secondary' as const;
}

export default async function EtlPage() {
  const warnings: string[] = [];
  const jobs = await listEtlJobs();
  const storedRekt = await readDatasetRecords<RektIncidentRecord>('rekt-incidents');
  const storedSolodit = await readDatasetRecords<SoloditFindingRecord>('solodit-findings');

  const rektIncidents = storedRekt.length > 0
    ? storedRekt
    : await fetchRekt2026Incidents(2).catch((error) => {
      warnings.push(`Rekt live preview unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return [] as RektIncidentRecord[];
    });

  const soloditFindings = storedSolodit.length > 0
    ? storedSolodit
    : await fetchSoloditFindings({ maxFindings: 150, maxSitemaps: 2 }).catch((error) => {
      warnings.push(`Solodit live preview unavailable: ${error instanceof Error ? error.message : String(error)}`);
      return [] as SoloditFindingRecord[];
    });

  const severityCounts = soloditFindings.reduce<Record<string, number>>((accumulator, finding) => {
    accumulator[finding.severity] = (accumulator[finding.severity] ?? 0) + 1;
    return accumulator;
  }, {});

  const hasData = rektIncidents.length > 0 || soloditFindings.length > 0;

  return (
    <div className="space-y-6 pb-8">
      {!hasData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-400" />No cached data yet</CardTitle>
            <CardDescription>The ETL pipeline hasn't run yet or no Blob storage is configured. The page is showing a bounded live preview when available; trigger a refresh to seed persistent datasets.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action="/api/etl/run" method="post">
              <Button type="submit">Trigger ETL refresh now</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Threat-intel ETL workspace</CardTitle>
            <CardDescription>Normalized datasets for local telemetry, all visible 2026 Rekt incidents, and Solodit findings discovered via sitemap ingestion.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Newspaper className="h-5 w-5" />
              </div>
              <div className="text-2xl font-semibold">{formatNumber(rektIncidents.length)}</div>
              <p className="mt-1 text-sm text-muted-foreground">Rekt 2026 incidents</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="text-2xl font-semibold">{formatNumber(soloditFindings.length)}</div>
              <p className="mt-1 text-sm text-muted-foreground">Solodit findings discovered</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <DatabaseZap className="h-5 w-5" />
              </div>
              <div className="text-2xl font-semibold">{formatNumber(jobs.length)}</div>
              <p className="mt-1 text-sm text-muted-foreground">Recorded ETL jobs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Refresh pipeline</CardTitle>
            <CardDescription>Run the ETL route to persist the current external sources into JSONL datasets and Blob artifacts, then use those findings to define the next red-team prompt.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-muted-foreground">
              Discovery uses server-rendered Rekt article cards and the Solodit sitemap because the main findings UI is client-hydrated.
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-amber-200">
              Operator flow: review the newest exploit pattern here, select a prompt template from the dashboard or roadmap, then launch the scenario from the CLI workflow.
            </div>
            <form action="/api/etl/run" method="post">
              <Button type="submit">Trigger ETL refresh</Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Latest Rekt incidents</CardTitle>
            <CardDescription>Recent 2026 exploit narratives normalized from Rekt News cards and article metadata.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {rektIncidents.slice(0, 8).map((incident) => (
              <div key={incident.incidentId} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{incident.title}</div>
                    <div className="mt-1 text-muted-foreground">{formatDate(incident.publishedAt)} · {incident.protocolName}</div>
                  </div>
                  {incident.lossEstimateUsd ? <Badge>{`$${formatNumber(Math.round(incident.lossEstimateUsd))}`}</Badge> : null}
                </div>
                <p className="text-muted-foreground">{incident.summary}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {incident.tags.slice(0, 4).map((tag) => <Badge key={`${incident.incidentId}-${tag}`} variant="secondary">{tag}</Badge>)}
                  {incident.exploitType ? <Badge variant="secondary">{incident.exploitType}</Badge> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Solodit coverage snapshot</CardTitle>
            <CardDescription>Issue pages are discovered from sitemap URLs and normalized into structured finding records.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(severityCounts).map(([severity, count]) => (
                <Badge key={severity} variant={severityVariant(severity as SoloditFindingRecord['severity'])}>{severity}: {formatNumber(count)}</Badge>
              ))}
            </div>
            <div className="space-y-3">
              {soloditFindings.slice(0, 8).map((finding) => (
                <div key={finding.findingId} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{finding.title}</div>
                      <div className="mt-1 text-muted-foreground">{finding.reportLabel ?? 'Sitemap-discovered issue'}{finding.protocolHint ? ` · ${finding.protocolHint}` : ''}</div>
                    </div>
                    <Badge variant={severityVariant(finding.severity)}>{finding.severity}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{finding.sourceUrl}</div>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">
              <div className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Parser note</div>
              Solodit titles and protocol hints are derived from stable sitemap slugs because the detail UI hydrates most finding content client-side.
            </div>
          </CardContent>
        </Card>
      </section>

      {warnings.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Source health warnings</CardTitle>
            <CardDescription>The page stayed online, but one or more external ETL sources did not respond successfully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-amber-200">
            {warnings.map((warning) => (
              <div key={warning} className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3">{warning}</div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
