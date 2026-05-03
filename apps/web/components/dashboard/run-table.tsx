import type { SimulationRunRecord } from '../../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatCompactNumber, formatDate, formatPercent } from '../../lib/utils';

export function RunTable({ runs }: { runs: SimulationRunRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historical simulation runs</CardTitle>
        <CardDescription>Mission-control run history assembled from each manifest and its companion epoch logs, ready for richer training and payment metadata.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-white/10">
              <th className="pb-3 pr-4 font-medium">Run</th>
              <th className="pb-3 pr-4 font-medium">Lifecycle</th>
              <th className="pb-3 pr-4 font-medium">Scenario</th>
              <th className="pb-3 pr-4 font-medium">Network</th>
              <th className="pb-3 pr-4 font-medium">Protocols</th>
              <th className="pb-3 pr-4 font-medium">Episode budget</th>
              <th className="pb-3 pr-4 font-medium">Agent instances</th>
              <th className="pb-3 pr-4 font-medium">Exploit success</th>
              <th className="pb-3 pr-4 font-medium">Replay fidelity</th>
              <th className="pb-3 font-medium">Completed</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.runId} className="border-b border-white/5">
                <td className="py-4 pr-4 font-medium">{run.runId}</td>
                <td className="py-4 pr-4 text-muted-foreground">Completed</td>
                <td className="py-4 pr-4 text-muted-foreground">{run.scenarioId}</td>
                <td className="py-4 pr-4 text-muted-foreground">{run.network}</td>
                <td className="py-4 pr-4">{run.protocolCount}</td>
                <td className="py-4 pr-4">{formatCompactNumber(run.protocols.reduce((sum, protocol) => sum + protocol.episodeCount, 0))}</td>
                <td className="py-4 pr-4">{formatCompactNumber(run.agentInstanceCount)}</td>
                <td className="py-4 pr-4">{formatPercent(run.aggregate.exploitSuccessRate)}</td>
                <td className="py-4 pr-4">{formatPercent(run.aggregate.averageReplayFidelity)}</td>
                <td className="py-4 text-muted-foreground">{formatDate(run.completedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
