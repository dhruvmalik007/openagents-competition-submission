import type { ProtocolDashboardRecord } from '../../lib/types';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { formatDate, formatPercent } from '../../lib/utils';

export function ProtocolTable({ protocols }: { protocols: ProtocolDashboardRecord[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocol coverage</CardTitle>
        <CardDescription>Each row is bound to the inventory schema and enriched with replay metrics from actual run history.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-white/10">
              <th className="pb-3 pr-4 font-medium">Protocol</th>
              <th className="pb-3 pr-4 font-medium">Contracts</th>
              <th className="pb-3 pr-4 font-medium">Simulated</th>
              <th className="pb-3 pr-4 font-medium">Exploit success</th>
              <th className="pb-3 pr-4 font-medium">Replay fidelity</th>
              <th className="pb-3 font-medium">Latest run</th>
            </tr>
          </thead>
          <tbody>
            {protocols.map((protocol) => (
              <tr key={protocol.protocolSlug} className="border-b border-white/5 align-top">
                <td className="py-4 pr-4">
                  <div className="space-y-2">
                    <div className="font-medium">{protocol.protocolName}</div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{protocol.protocolSlug}</Badge>
                      {protocol.incidentReference ? <Badge>{protocol.incidentReference}</Badge> : null}
                    </div>
                  </div>
                </td>
                <td className="py-4 pr-4 text-muted-foreground">{protocol.verifiedContracts}/{protocol.contractCount} verified</td>
                <td className="py-4 pr-4">{protocol.timesSimulated}</td>
                <td className="py-4 pr-4">{formatPercent(protocol.averageExploitSuccessRate)}</td>
                <td className="py-4 pr-4">{formatPercent(protocol.averageReplayFidelity)}</td>
                <td className="py-4 text-muted-foreground">{protocol.latestRunAt ? formatDate(protocol.latestRunAt) : 'Not yet run'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
