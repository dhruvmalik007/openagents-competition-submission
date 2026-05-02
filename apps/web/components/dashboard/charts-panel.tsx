'use client';

import { Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Bar, BarChart } from 'recharts';
import type { DashboardTimePoint, DashboardOverview } from '../../lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';

const pieColors = ['#22d3ee', '#a855f7', '#10b981', '#f59e0b'];

export function ChartsPanel({ overview, timeseries }: { overview: DashboardOverview; timeseries: DashboardTimePoint[] }) {
  return (
    <section className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Operational tempo</CardTitle>
          <CardDescription>Simulation throughput and agent provisioning based on persisted run manifests.</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeseries}>
              <defs>
                <linearGradient id="runsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="bucket" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 16 }} />
              <Area type="monotone" dataKey="runs" stroke="#22d3ee" fill="url(#runsFill)" strokeWidth={2} />
              <Area type="monotone" dataKey="agentInstances" stroke="#a855f7" fillOpacity={0} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Agent role mix</CardTitle>
          <CardDescription>Action and memory distribution across attacker, CISO, defender, and judge roles.</CardDescription>
        </CardHeader>
        <CardContent className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={overview.agentRoleTotals} dataKey="actionCount" nameKey="role" innerRadius={60} outerRadius={100} paddingAngle={3}>
                {overview.agentRoleTotals.map((entry: DashboardOverview['agentRoleTotals'][number], index: number) => (
                  <Cell key={entry.role} fill={pieColors[index % pieColors.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 16 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="xl:col-span-3">
        <CardHeader>
          <CardTitle>Role reward + memory quality</CardTitle>
          <CardDescription>Aggregated reward and memory-write intensity derived from epoch logs.</CardDescription>
        </CardHeader>
        <CardContent className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={overview.agentRoleTotals}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
              <XAxis dataKey="role" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 16 }} />
              <Bar dataKey="reward" fill="#22d3ee" radius={[8, 8, 0, 0]} />
              <Bar dataKey="memoryWrites" fill="#a855f7" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </section>
  );
}
