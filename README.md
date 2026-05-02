# Aegis Arena

Aegis Arena is a Turborepo-based monorepo for a CLI-first multi-agent DeFi security simulation framework built on 0G.

## Workspace Layout

- `apps/cli` — user-facing CLI
- `apps/web` — Vercel-native SPA dashboard, ETL control plane, and per-user vector memory UI
- `packages/core` — simulation runtime and epoch log model
- `packages/etl` — incident ingestion and enrichment pipeline contracts
- `packages/og` — 0G testnet configuration and adapter contracts
- `packages/contracts` — contract inventory loaders and metadata helpers
- `packages/kurtosis` — reproducible blockchain simulation package for local enclaves
- `packages/config` — shared CLI manifest and command design
- `data/` — network metadata and protocol inventory JSON
- `schemas/` — JSON schemas for inventories and scenarios
- `docs/` — architectural notes and CLI/logging design

## Quick Start

```bash
pnpm install
pnpm build
pnpm --filter @aegis-arena/cli dev -- --help
```

See `tasks.md` for the current statement of work, `docs/cli-actions-and-logs.md` for the command and logging model, `docs/autoresearch-loop.md` for the bounded experiment loop that now drives scenario training, and `docs/0g-testnet-safe-attestation-runbook.md` for the Galileo Safe/Ledger onboarding and attestation validation flow.

For the Vercel-backed dashboard, JSONL ETL pipeline, and per-user vector database setup, see [docs/vercel-control-plane.md](docs/vercel-control-plane.md).

## Safe Login MVP

The CLI now includes a first working Safe-owner login flow with three signer modes:

- browser wallet via a temporary localhost signing page,
- direct owner EOA private key,
- USB Ledger owner signing.

Example:

```bash
pnpm --filter @aegis-arena/cli dev -- login safe --safe <safe_address> --mode private-key --private-key 0x...

To publish the verified CLI session into the web control plane:

```bash
pnpm --filter @aegis-arena/cli dev -- login sync-web --base-url http://localhost:3000
```

## Web Control Plane

The repo now includes a Next.js SPA in `apps/web` with:

- live dashboards derived from protocol inventory JSON and simulation manifests
- Vercel Function APIs for metrics, ETL runs, and vector search
- a Blob/JSONL ETL materialization flow
- per-user vector storage designed for Neon + pgvector with local fallback

Run it locally with:

```bash
pnpm --filter @aegis-arena/web dev
```
```

## 0G Faucet MVP

The CLI now includes a browser-assisted Galileo faucet helper that verifies balance changes over RPC and stores a local receipt:

```bash
pnpm --filter @aegis-arena/cli dev -- og faucet claim --address <wallet_address>
pnpm --filter @aegis-arena/cli dev -- og balance --address <wallet_address>
```
