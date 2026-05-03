import Link from 'next/link';
import type { Route } from 'next';
import type { DashboardOverview, RoadmapItemRecord } from '../../lib/types';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

function phaseVariant(phase: RoadmapItemRecord['phase']) {
  if (phase === 'live-now') return 'success' as const;
  if (phase === 'next-up') return 'warning' as const;
  return 'secondary' as const;
}

export function RoadmapPreview({ overview }: { overview: DashboardOverview }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Implementation roadmap inside the app</CardTitle>
        <CardDescription>These are the remaining pitch features, mapped directly to the existing surfaces so you can ship them without a major redesign.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {overview.roadmap.slice(0, 5).map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{item.title}</div>
                <div className="mt-1 text-muted-foreground">{item.summary}</div>
              </div>
              <Badge variant={phaseVariant(item.phase)}>{item.phase.replace('-', ' ')}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">Lands in {item.targetSurface} · Depends on {item.dependency}</div>
          </div>
        ))}
        <Link href={'/roadmap' as Route} className="inline-flex text-sm text-cyan-300 hover:underline">
          Open full roadmap
        </Link>
      </CardContent>
    </Card>
  );
}
