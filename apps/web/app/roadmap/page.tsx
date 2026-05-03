import { Badge } from '../../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { getDashboardSnapshot } from '../../lib/server/dashboard';
import type { PromptTemplateRecord, RoadmapItemRecord } from '../../lib/types';

export const dynamic = 'force-dynamic';

function phaseVariant(phase: RoadmapItemRecord['phase']) {
  if (phase === 'live-now') return 'success' as const;
  if (phase === 'next-up') return 'warning' as const;
  return 'secondary' as const;
}

function phaseTitle(phase: RoadmapItemRecord['phase']) {
  if (phase === 'live-now') return 'Live now';
  if (phase === 'next-up') return 'Next up';
  return 'Roadmap';
}

function groupByPhase(items: RoadmapItemRecord[]) {
  return {
    'live-now': items.filter((item) => item.phase === 'live-now'),
    'next-up': items.filter((item) => item.phase === 'next-up'),
    roadmap: items.filter((item) => item.phase === 'roadmap')
  };
}

function templateSurface(template: PromptTemplateRecord) {
  return template.recommendedSurface === 'etl'
    ? 'Use the ETL page to discover the exploit pattern, then launch the scenario from the CLI.'
    : template.recommendedSurface === 'modules'
      ? 'Pair this with the Modules page to explain runtime and inference posture.'
      : 'Best shown from the dashboard after the workflow seeds the run history.';
}

export default async function RoadmapPage() {
  const snapshot = await getDashboardSnapshot();
  const grouped = groupByPhase(snapshot.overview.roadmap);

  return (
    <div className="space-y-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>Implementation roadmap</CardTitle>
          <CardDescription>
            This page turns the remaining final-pitch features into an in-app build plan. It follows the current architecture: dashboard for mission control,
            ETL for attack-vector context, modules for 0G execution posture, and settings for runtime trust plus future settlement visibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-3 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 font-medium">0G-aligned roadmap tracks</div>
            <div className="space-y-2 text-muted-foreground">
              <div>Inference integration and operator-visible runtime posture</div>
              <div>Storage and retained artifact persistence</div>
              <div>Fine-tuning from replay, ETL, and judged-memory datasets</div>
              <div>Alignment and operator policy controls for governed automation</div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 font-medium">Why this fits the current app</div>
            <div className="space-y-2 text-muted-foreground">
              <div>No new architecture is required.</div>
              <div>The remaining work is mostly metadata, naming, and operator-facing summaries.</div>
              <div>The same dashboard snapshot can drive roadmap, mission control, and prompt-template UI.</div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 font-medium">Current wallet context</div>
            <div className="text-muted-foreground">{snapshot.overview.onChainActivity.walletLabel}</div>
            <div className="mt-2 text-muted-foreground">{snapshot.overview.onChainActivity.note}</div>
          </div>
        </CardContent>
      </Card>

      {(['live-now', 'next-up', 'roadmap'] as const).map((phase) => (
        <Card key={phase}>
          <CardHeader>
            <CardTitle>{phaseTitle(phase)}</CardTitle>
            <CardDescription>
              {phase === 'live-now'
                ? 'Features already reflected in the app and safe to emphasize in the demo.'
                : phase === 'next-up'
                  ? 'The smallest changes that unlock the remaining pitch promises.'
                  : 'Longer-horizon work aligned with 0G inference, storage, fine-tuning, and governed agent operations.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 lg:grid-cols-2">
            {grouped[phase].map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="font-medium">{item.title}</div>
                  <Badge variant={phaseVariant(item.phase)}>{phaseTitle(item.phase)}</Badge>
                </div>
                <p className="text-muted-foreground">{item.summary}</p>
                <div className="mt-3 text-xs text-muted-foreground">Landing surface: {item.targetSurface} · Dependency: {item.dependency}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle>Prompt-template rollout</CardTitle>
          <CardDescription>Use these templates to demonstrate user-defined red-team strategy today, then promote them into first-class CLI or UI scenario controls.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          {snapshot.overview.promptTemplates.map((template) => (
            <div key={template.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <div className="mb-2 font-medium">{template.title}</div>
              <p className="text-muted-foreground">{template.objective}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {template.roles.map((role) => <Badge key={`${template.id}-${role}`} variant="secondary">{role}</Badge>)}
              </div>
              <div className="mt-3 text-xs text-muted-foreground">{templateSurface(template)}</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
