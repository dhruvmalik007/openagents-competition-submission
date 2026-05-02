import { Bot, Database, FolderKanban, Radar, ShieldAlert, Workflow } from 'lucide-react';
import type { DashboardOverview } from '../../lib/types';
import { formatCompactNumber } from '../../lib/utils';
import { Card, CardContent } from '../ui/card';

const metricDefinitions = [
  { key: 'simulationRuns', label: 'Simulation runs', icon: Workflow },
  { key: 'simulationEpisodes', label: 'Episodes', icon: Radar },
  { key: 'agentInstances', label: 'Agent instances', icon: Bot },
  { key: 'redTeamedProtocols', label: 'Red-teamed protocols', icon: ShieldAlert },
  { key: 'inventories', label: 'Protocol inventories', icon: FolderKanban },
  { key: 'vectorDocuments', label: 'Vector documents', icon: Database }
] as const;

export function MetricCards({ overview }: { overview: DashboardOverview }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {metricDefinitions.map((metric) => {
        const Icon = metric.icon;
        const value = overview.totals[metric.key];
        return (
          <Card key={metric.key}>
            <CardContent className="flex items-start justify-between p-6">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">{formatCompactNumber(value)}</p>
              </div>
              <div className="rounded-2xl bg-primary/10 p-3 text-primary">
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
