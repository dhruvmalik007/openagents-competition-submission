import Link from 'next/link';
import type { Route } from 'next';
import type { DashboardOverview } from '../../lib/types';
import { formatCompactNumber, formatDate } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

function surfaceHref(surface: DashboardOverview['operatorActions'][number]['targetSurface']): string {
  switch (surface) {
    case 'etl':
      return '/etl';
    case 'modules':
      return '/modules';
    case 'settings':
      return '/settings';
    case 'roadmap':
      return '/roadmap';
    case 'dashboard':
    default:
      return '/dashboard';
  }
}

function statusVariant(status: 'ready' | 'attention' | 'planned') {
  if (status === 'ready') return 'success' as const;
  if (status === 'attention') return 'warning' as const;
  return 'secondary' as const;
}

function settlementVariant(status: DashboardOverview['onChainActivity']['settlementStatus']) {
  if (status === 'ready-for-surface') return 'success' as const;
  if (status === 'awaiting-session') return 'warning' as const;
  return 'secondary' as const;
}

export function MissionControlPanel({ overview }: { overview: DashboardOverview }) {
  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Mission control</CardTitle>
          <CardDescription>Operator-facing lifecycle status for the latest simulation, training-ready workflow, and active agent role mix.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-2">
            <Badge>{overview.missionControl.heading}</Badge>
            <Badge variant={overview.missionControl.phase === 'awaiting-run' ? 'warning' : 'success'}>{overview.missionControl.statusLabel}</Badge>
            <Badge variant="secondary">{overview.missionControl.networkLabel}</Badge>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-muted-foreground">
            {overview.missionControl.summary}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-muted-foreground">Latest run</div>
              <div className="mt-2 font-medium">{overview.missionControl.runId ?? 'Waiting for first workflow execution'}</div>
              <div className="mt-1 text-muted-foreground">{overview.missionControl.scenarioId ?? 'Launch from the CLI to populate mission control.'}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-muted-foreground">Episode budget</div>
              <div className="mt-2 font-medium">{formatCompactNumber(overview.missionControl.episodeBudget)}</div>
              <div className="mt-1 text-muted-foreground">{overview.missionControl.stepsPerEpisode} steps per episode · {overview.missionControl.protocolCount} protocols</div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 font-medium">Active roles</div>
            <div className="flex flex-wrap gap-2">
              {overview.missionControl.roleLabels.length > 0
                ? overview.missionControl.roleLabels.map((role) => <Badge key={role} variant="secondary">{role}</Badge>)
                : <Badge variant="warning">No role activity yet</Badge>}
            </div>
            <div className="mt-3 text-xs text-muted-foreground">
              {overview.missionControl.lastUpdatedAt ? `Last update ${formatDate(overview.missionControl.lastUpdatedAt)}` : 'Run the CLI workflow to turn this into a live operator feed.'}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operator next actions</CardTitle>
          <CardDescription>Short-term steps that make the pitch features real inside the current app, without changing the framework dramatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.operatorActions.map((action) => (
            <div key={action.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{action.title}</div>
                  <div className="mt-1 text-muted-foreground">{action.detail}</div>
                </div>
                <Badge variant={statusVariant(action.status)}>{action.status}</Badge>
              </div>
              <Link href={surfaceHref(action.targetSurface) as Route} className="text-xs text-cyan-300 hover:underline">
                Open {action.targetSurface}
              </Link>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt templates</CardTitle>
          <CardDescription>Demo-ready adversarial scenarios you can use immediately while a richer CLI prompt selector is added.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {overview.promptTemplates.map((template) => (
            <div key={template.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="font-medium">{template.title}</div>
                <Link href={surfaceHref(template.recommendedSurface) as Route} className="text-xs text-cyan-300 hover:underline">
                  Open {template.recommendedSurface}
                </Link>
              </div>
              <p className="text-muted-foreground">{template.objective}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {template.roles.map((role) => <Badge key={`${template.id}-${role}`} variant="secondary">{role}</Badge>)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>On-chain activity and role economics</CardTitle>
          <CardDescription>Prepared surface for agent settlement, cost visibility, and payment references using the same wallet identity already synced from the CLI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="font-medium">Wallet context</div>
              <Badge variant={settlementVariant(overview.onChainActivity.settlementStatus)}>{overview.onChainActivity.settlementStatus}</Badge>
            </div>
            <div className="text-muted-foreground">{overview.onChainActivity.walletLabel}</div>
            <div className="mt-2 text-muted-foreground">{overview.onChainActivity.note}</div>
            <div className="mt-3 rounded-xl bg-black/30 p-3 text-xs text-cyan-300">{overview.onChainActivity.paymentReference}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {overview.agentRoleTotals.map((role) => (
              <div key={role.role} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="font-medium">{role.role}</div>
                <div className="mt-2 text-muted-foreground">Actions {formatCompactNumber(role.actionCount)} · Memory writes {formatCompactNumber(role.memoryWrites)}</div>
                <div className="mt-1 text-muted-foreground">Reward {role.reward.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
