'use client';

import { useMemo, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { DashboardOverview, VectorDocumentRecord, VectorSpec } from '../../lib/types';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';

export function AuthAndVector({ overview, spec }: { overview: DashboardOverview; spec: VectorSpec }) {
  const [safeAddress, setSafeAddress] = useState(overview.session?.safeAddress ?? '');
  const [userId, setUserId] = useState('');
  const [query, setQuery] = useState('bridge exploit liquidity drain');
  const [feedback, setFeedback] = useState('Defender policy should escalate sooner once detection confidence exceeds 0.55 and bridge routes > 2.');
  const [results, setResults] = useState<VectorDocumentRecord[]>([]);
  const [status, setStatus] = useState<string>('');

  const derivedUserId = useMemo(() => userId.trim(), [userId]);

  async function runSearch() {
    setStatus('Searching vector memory…');
    const response = await fetch('/api/vector/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: derivedUserId || 'local-operator', safeAddress, namespace: 'default', query, limit: 5 })
    });
    const payload = await response.json();
    setResults(payload.results ?? []);
    setStatus(response.ok ? 'Search complete.' : payload.error ?? 'Search failed.');
  }

  async function submitFeedback() {
    setStatus('Persisting RLHF feedback…');
    const response = await fetch('/api/vector/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: derivedUserId || 'local-operator', safeAddress, namespace: 'default', feedbackText: feedback, rewardSignal: 0.82 })
    });
    const payload = await response.json();
    setStatus(response.ok ? `Stored feedback document ${payload.record?.id ?? ''}` : payload.error ?? 'Feedback write failed.');
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>CLI onboarding and scenario launch</CardTitle>
          <CardDescription>This mirrors the wallet-first auth and workflow command surface already implemented in the CLI.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 text-sm">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-medium">1. Authenticate in the terminal</div>
            <code className="block rounded-xl bg-black/40 p-3 text-xs text-cyan-300">aegis login wallet</code>
            <p className="text-muted-foreground">If auth mode is omitted, the CLI can prompt the operator to choose between browser wallet, Ledger, or Privy-backed login.</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-medium">2. Pick the signer mode</div>
            <div className="flex flex-wrap gap-2">
              <Badge>Browser wallet</Badge>
              <Badge variant="secondary">Ledger / USB hardware wallet</Badge>
              <Badge variant="warning">Privy app-linked login</Badge>
            </div>
            <p className="text-muted-foreground">The backend stores a published CLI session so this dashboard can attach a wallet-controlled identity to ETL jobs, vector namespaces, operator surfaces, and RLHF feedback.</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-medium">3. Publish the CLI session to the web backend</div>
            <code className="block rounded-xl bg-black/40 p-3 text-xs text-cyan-300">aegis login sync-web --base-url http://localhost:3000</code>
            <p className="text-muted-foreground">That handshake keeps the dashboard and vector namespace keyed to the same Safe + signer tuple used by the simulator.</p>
          </div>
          <div className="space-y-3 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="font-medium">4. Launch an end-to-end scenario</div>
            <code className="block rounded-xl bg-black/40 p-3 text-xs text-cyan-300">aegis workflow run --base-url http://localhost:3000 --inference og-mock --episodes 1 --steps 8 --slug rhea-finance</code>
            <p className="text-muted-foreground">This one command binds onboarding, session sync, ETL refresh, and the simulation launch into one demo-ready operator workflow.</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Per-user vector database workbench</CardTitle>
          <CardDescription>Real API-backed vector inserts/searches for protocol notes, run memory, and RLHF-style reward feedback.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="User id" value={userId} onChange={(event: ChangeEvent<HTMLInputElement>) => setUserId(event.target.value)} />
            <Input placeholder="Safe address" value={safeAddress} onChange={(event: ChangeEvent<HTMLInputElement>) => setSafeAddress(event.target.value)} />
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-muted-foreground">
            <div>Provider: {spec.provider}</div>
            <div>Embedding model: {spec.embeddingModel}</div>
            <div>Dimension: {spec.dimension}</div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Input value={query} onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Search user memory" />
            <Button type="button" onClick={runSearch}>Search vector memory</Button>
          </div>
          <div className="space-y-2">
            <Textarea value={feedback} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setFeedback(event.target.value)} />
            <Button type="button" variant="secondary" onClick={submitFeedback}>Store RLHF feedback</Button>
          </div>
          <p className="text-sm text-muted-foreground">{status}</p>
          <div className="space-y-3">
            {results.map((result) => (
              <div key={result.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <Badge>{result.documentType}</Badge>
                  <span className="text-xs text-muted-foreground">similarity {(result.similarity ?? 0).toFixed(3)}</span>
                </div>
                <p>{result.content}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
