# Vercel Web Control Plane

This document describes the Vercel-backed SPA and backend added in [apps/web](../apps/web) for Aegis Arena.

## What the web app does

The web app is a Next.js App Router application designed to run on Vercel Functions and expose one cohesive operational dashboard for:

- protocol inventory coverage
- historical simulation throughput
- attacker / CISO / defender / judge telemetry
- ETL materialization into JSONL datasets
- Safe-session aware dashboard context
- per-user vector memory and RLHF-style feedback capture

The UI is intentionally single-page so teams can open one control plane and see:

- how many protocol inventories exist
- how many protocols have actually been red-teamed
- how many simulation runs and episodes have been executed
- how many agent instances were provisioned across epochs
- whether Blob / vector storage are configured
- the current published Safe session

## Runtime architecture

### Frontend

`apps/web/app/page.tsx` is a server-rendered SPA shell that reads the same backend services used by the API routes.

Key UI sections:

- `Hero` — project scope, identity context, storage posture
- `MetricCards` — top-level KPI cards
- `ChartsPanel` — run tempo and role distributions using `recharts`
- `PipelinePanel` — ETL execution + recent job history
- `AuthAndVector` — Safe login workflow + interactive vector search / feedback
- `ProtocolTable` — inventory-backed protocol coverage table
- `RunTable` — real run history from persisted manifests

### Backend

The backend is implemented as Next.js route handlers, which map directly to Vercel Functions in production.

Current function surface:

- `/api/dashboard/overview`
- `/api/dashboard/protocols`
- `/api/dashboard/runs`
- `/api/dashboard/timeseries`
- `/api/etl/jobs`
- `/api/etl/run`
- `/api/auth/local-session`
- `/api/auth/cli-session`
- `/api/vector/spec`
- `/api/vector/upsert`
- `/api/vector/search`
- `/api/vector/feedback`

## Data sources and guarantees

The dashboard is not fed by hardcoded frontend data.

### Simulation metrics

Simulation metrics come from the persisted artifacts already produced by the CLI in `runs/rl-sim/*`:

- `manifest.json`
- `epoch-logs.jsonl`
- `openenv-step-results.jsonl`

The web layer aggregates these files through `lib/server/local-repository.ts` and `lib/server/dashboard.ts`.

### Protocol metrics

Protocol inventory counts come from `data/inventory/protocols/*.json`.

That means contract counts, resource counts, incident references, and verification ratios are connected directly to the same schema used by the simulator.

### Safe session context

The dashboard can derive user context in two ways:

1. **Local development**: read `~/.aegis-arena/session.json`
2. **Published session**: read a session posted to `/api/auth/cli-session`

This keeps the web dashboard aligned to the same Safe owner / signer pair already authenticated by the CLI.

## CLI to web login workflow

### Step 1 — authenticate with the CLI

```bash
aegis login safe --safe <safe_address>
```

If `--mode` is omitted, the CLI now prompts the operator to choose a signer mode:

- `browser`
- `ledger`
- `private-key`

### Step 2 — publish the session to the web app

```bash
aegis login sync-web --base-url http://localhost:3000
```

This sends the verified local session JSON to:

```text
POST /api/auth/cli-session
```

Once published, the web app can attach dashboard state and vector namespaces to the authenticated Safe context.

## ETL pipeline design

The ETL pipeline is intentionally minimalist and Vercel-native.

### Trigger model

- manual trigger: `POST /api/etl/run`
- cron trigger: `GET /api/etl/run?source=cron`
- configured via [apps/web/vercel.json](../apps/web/vercel.json)

### Output datasets

Each ETL run materializes four JSONL datasets:

- `etl/datasets/protocols.jsonl`
- `etl/datasets/simulations.jsonl`
- `etl/datasets/epochs.jsonl`
- `etl/datasets/agent-instances.jsonl`

### Storage model

The artifact writer uses one shared abstraction:

- local development fallback: `runs/web-data/...`
- Vercel production: `@vercel/blob`

### Why JSONL here

JSONL is used because it is:

- append-friendly
- easy to stream and diff
- easy to hydrate into downstream vector pipelines
- operationally simple for Vercel Functions and Blob storage

## Per-user vector database specification

The vector layer is split into two concerns:

1. **Blob / JSONL archival** for append-heavy ETL artifacts
2. **pgvector search** for low-latency user memory retrieval

### Recommended production provider

Use a Neon Postgres integration from the Vercel Marketplace with the `vector` extension enabled.

The app already supports this through `postgres` and the SQL schema in [apps/web/db/schema.sql](../apps/web/db/schema.sql).

### Tables

#### `user_vector_documents`

Purpose:

- protocol notes
- run memory
- ETL fragments
- RLHF prompts / memory chunks

Key columns:

- `user_id`
- `safe_address`
- `namespace`
- `document_type`
- `content`
- `embedding vector(1536)`
- `metadata jsonb`

#### `user_rlhf_feedback`

Purpose:

- human reward annotations
- protocol-specific corrective hints
- run-linked feedback signals for policy tuning

Key columns:

- `user_id`
- `safe_address`
- `run_id`
- `protocol_slug`
- `reward_signal`
- `feedback_text`

#### `published_cli_sessions`

Purpose:

- connect a verified Safe-authenticated CLI session to the web control plane

Key columns:

- `session_id`
- `safe_address`
- `signer_address`
- `mode`
- `issued_at`
- `expires_at`

### Namespace model

Each user is isolated by:

- `user_id`
- `safe_address`
- `namespace`

Recommended namespaces:

- `default`
- `protocol:<slug>`
- `run:<runId>`
- `feedback`
- `etl`

This keeps one user’s memory, notes, and reward tuning data separated from another user’s research workspace.

### Embedding model

The implementation currently defaults to:

- dimension: `1536`
- embedding model label: `deterministic-hash-v1`

That deterministic embedder exists so local development works without external inference keys.

For production, replace it with a real embedding provider while preserving the same API contract.

### Query pattern

Similarity search is always filtered by identity first, then ranked by cosine distance:

```sql
select *
from user_vector_documents
where user_id = $user_id
  and safe_address = $safe_address
  and namespace = $namespace
order by embedding <=> $query_vector
limit $limit;
```

### Why this split matters

- **Blob** is the durable append-oriented archive for ETL outputs and exported datasets
- **pgvector** is the retrieval path for live semantic memory queries

That keeps the platform fast for search while still preserving a clear immutable audit trail.

## Environment variables

### Required for local UI only

None. The app can read repo data and local Safe session files without external storage.

### Recommended for Vercel production

- `POSTGRES_URL` or `DATABASE_URL` — Neon / Postgres connection string
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob token
- `AEGIS_VECTOR_DIMENSION` — defaults to `1536`
- `AEGIS_VECTOR_EMBEDDING_MODEL` — defaults to `deterministic-hash-v1`
- `AEGIS_REPO_ROOT` — optional monorepo override in local environments
- `AEGIS_DATA_ROOT` — optional override for local generated ETL artifacts

## Local development

From repo root:

```bash
pnpm install
pnpm --filter @aegis-arena/web dev
```

Then, in another terminal:

```bash
aegis login safe --safe <safe_address>
aegis login sync-web --base-url http://localhost:3000
```

Open:

```text
http://localhost:3000
```

## Vercel deployment notes for Frontier-tech-labs

### Project root

Set the Vercel project root to:

```text
apps/web
```

### Build command

```bash
pnpm build
```

### Install command

```bash
pnpm install
```

### Cron

The app includes a cron definition in [apps/web/vercel.json](../apps/web/vercel.json):

```json
{
  "crons": [
    {
      "path": "/api/etl/run?source=cron",
      "schedule": "0 * * * *"
    }
  ]
}
```

### Recommended first production sequence

1. connect Neon from the Vercel Marketplace
2. create or attach a Vercel Blob store
3. set the environment variables listed above
4. deploy `apps/web`
5. publish a CLI session with `aegis login sync-web --base-url <deployment-url>`
6. trigger one ETL run through `/api/etl/run`
7. verify the dashboard is rendering live protocol + run metrics

## Limitations

- Current dashboard metrics are sourced from repo-local inventories and run artifacts; production automation should upload newly produced run artifacts into Blob if you want the dashboard to outlive ephemeral deployments.
- The vector layer ships with a deterministic local embedder for dev ergonomics; swap in a production embedding provider for higher semantic quality.
- Session publishing is one-way right now; if you want browser-authenticated continuation, add a signed handoff token backed by the same `published_cli_sessions` table.
