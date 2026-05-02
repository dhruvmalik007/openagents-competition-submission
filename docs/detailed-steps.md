# Aegis Arena End-to-End Setup and Simulation Guide

This guide explains, in practical order, how to:

1. set up the Aegis Arena CLI,
2. connect the CLI to the web control plane,
3. run a DeFi attack-defense simulation using the 0G-backed inference path,
4. seed the web ETL datasets so the dashboard reflects the run.

It is written against the current repository state and the recent execution history in this workspace.

## What “connected end-to-end” means in this repo

In Aegis Arena, the end-to-end loop is:

1. the CLI authenticates an operator session,
2. the session is published to the web app,
3. the CLI runs a multi-agent simulation against a bundled DeFi protocol inventory,
4. the simulation writes artifacts into `runs/rl-sim/<run-id>/...`,
5. the web ETL pipeline ingests those artifacts into `runs/web-data/etl/datasets/*.jsonl`,
6. the dashboard and APIs surface the new data.

The important design detail is that the web app does **not** own the simulation runtime. The CLI produces run artifacts, and the web layer reads and materializes them.

## Current repo realities you should know first

Before following the steps, keep these implementation details in mind:

- The CLI lives in `apps/cli`.
- The web control plane lives in `apps/web`.
- Protocol inventories live in `data/inventory/protocols`.
- CLI simulation artifacts are written under `runs/rl-sim`.
- Web ETL datasets are written under `runs/web-data/etl/datasets` unless Blob storage is configured.
- The web app can run locally without external storage.
- The vector system can run in local JSON mode without Postgres.
- The 0G integration supports both direct inference and broker-authenticated inference.

One more important note from recent live testing:

- running `sim run --inference og-sealed` is operational,
- but **true provider-backed 0G inference** requires either:
	- a valid direct inference endpoint and API key, or
	- a funded wallet/private key plus a provider path on the 0G compute network.

If those are missing or the provider endpoint rejects requests, the current client falls back to mock responses while still preserving the run structure.

## Architecture map

Think of the system as four layers:

### 1. CLI layer

Used for:

- Safe login,
- faucet/balance checks,
- 0G status and provider inspection,
- simulation execution,
- optional storage/memory/fine-tuning workflows.

### 2. Shared 0G runtime layer

Implemented in `packages/og`.

This is where the repo resolves:

- Galileo vs mainnet defaults,
- RPC/indexer URLs,
- broker readiness,
- direct inference URL/API key usage,
- storage upload/download,
- fine-tuning task creation.

### 3. Web control plane

Implemented in `apps/web`.

It exposes APIs like:

- `POST /api/auth/cli-session`
- `POST /api/etl/run`
- `GET /api/etl/jobs`
- vector routes under `/api/vector/*`

### 4. Artifact and dataset layer

There are two main output zones:

- `runs/rl-sim/*` for simulation outputs,
- `runs/web-data/*` for web-ingested and ETL-materialized outputs.

## External prerequisites

You should have the following available before you start:

- macOS, Linux, or another Unix-like shell environment,
- Node.js installed,
- `pnpm` installed,
- browser access for Safe login and/or faucet use,
- optional Safe owner EOA or Ledger device,
- optional 0G credentials if you want true provider-backed inference instead of fallback mode.

## Recommended external references

These were refreshed while preparing this guide and match the current repo assumptions:

- 0G Galileo testnet docs: `https://docs.0g.ai/developer-hub/testnet/testnet-overview`
- 0G SDK hub: `https://build.0g.ai/sdks/`
- official 0G docs home: `https://docs.0g.ai/`
- official faucet: `https://faucet.0g.ai/`
- Google Cloud faucet: `https://cloud.google.com/application/web3/faucet/0g/galileo`
- 0G Compute SDK docs: `https://docs.0g.ai/developer-hub/building-on-0g/compute-network/sdk`

Current Galileo constants confirmed by both the repo and 0G docs:

- Network: `0G-Galileo-Testnet`
- Chain ID: `16602`
- Development RPC: `https://evmrpc-testnet.0g.ai`
- Explorer: `https://chainscan-galileo.0g.ai`
- Faucet: `https://faucet.0g.ai`

## Step 1 — Install dependencies and build the monorepo

From the repository root:

```bash
pnpm install
pnpm build
```

Why this matters:

- the CLI depends on workspace packages such as `@aegis-arena/og`, `@aegis-arena/core`, `@aegis-arena/etl`, and `@aegis-arena/rl-policy`,
- the web app reads shared runtime logic and generated artifacts,
- a full build verifies the workspace references are consistent.

If you want a lighter verification pass after install, run:

```bash
pnpm typecheck
```

## Step 2 — Choose how you want to invoke the CLI

You have two practical choices.

### Option A: use the repo-local dev command

This is the safest and easiest development path:

```bash
pnpm --filter @aegis-arena/cli dev -- --help
```

From here on, every CLI example in this document can be run in this form:

```bash
pnpm --filter @aegis-arena/cli dev -- <command>
```

Example:

```bash
pnpm --filter @aegis-arena/cli dev -- og status
```

### Option B: link the CLI globally

If you want the `aegis` command directly in your shell:

```bash
pnpm --filter @aegis-arena/cli link:global
```

Then you can run:

```bash
aegis --help
```

If you later want to remove the global link:

```bash
pnpm --filter @aegis-arena/cli unlink:global
```

## Step 3 — Set the environment variables you actually need

There are three categories of environment variables in this repo.

### Category A: local repo and web data routing

These are the most useful for local development:

```bash
export AEGIS_REPO_ROOT="$PWD"
export AEGIS_DATA_ROOT="$PWD/runs/web-data"
```

Why:

- `AEGIS_REPO_ROOT` helps the web app and helper scripts resolve the monorepo consistently,
- `AEGIS_DATA_ROOT` lets you control where web-side ETL and vector fallback files are written.

### Category B: web vector/database and Blob storage

These are optional for local usage, but useful in production:

```bash
export DATABASE_URL="..."
export POSTGRES_URL="..."
export BLOB_READ_WRITE_TOKEN="..."
export AEGIS_VECTOR_DIMENSION="1536"
export AEGIS_VECTOR_EMBEDDING_MODEL="deterministic-hash-v1"
```

You do **not** need these for a basic local smoke test.

### Category C: 0G runtime configuration

These matter for real 0G-backed inference, storage, and fine-tuning:

```bash
export AEGIS_OG_NETWORK="galileo"
export AEGIS_OG_RPC_URL="https://evmrpc-testnet.0g.ai"
export AEGIS_OG_INDEXER_RPC_URL="https://indexer-storage-testnet-turbo.0g.ai"
export AEGIS_OG_PRIVATE_KEY="0x..."
export AEGIS_OG_PROVIDER_ADDRESS="0x..."
export AEGIS_OG_INFERENCE_API_KEY="app-sk-..."
export AEGIS_OG_INFERENCE_SERVICE_URL="https://<provider-host>/v1/proxy"
```

Important interpretation:

- if `AEGIS_OG_INFERENCE_SERVICE_URL` is set, the client attempts a direct OpenAI-compatible `/chat/completions` call,
- if no direct service URL is set but `AEGIS_OG_PRIVATE_KEY` is set, the client can try broker-authenticated inference,
- if neither is set correctly, `og-sealed` can still execute the run but may fall back to mock output.

### Recommended local shell bootstrap

At minimum, use this before local work:

```bash
export AEGIS_REPO_ROOT="$PWD"
export AEGIS_DATA_ROOT="$PWD/runs/web-data"
export AEGIS_OG_NETWORK="galileo"
export AEGIS_OG_RPC_URL="https://evmrpc-testnet.0g.ai"
export AEGIS_OG_INDEXER_RPC_URL="https://indexer-storage-testnet-turbo.0g.ai"
```

## Step 4 — Start the web app locally

From repo root:

```bash
pnpm --filter @aegis-arena/web dev
```

Then open:

```text
http://localhost:3000
```

What this gives you:

- the dashboard,
- ETL endpoints,
- published CLI session endpoint,
- vector endpoints,
- run aggregation from local artifacts.

## Step 5 — Verify the CLI is wired correctly before you do anything more complex

Run:

```bash
pnpm --filter @aegis-arena/cli dev -- --help
pnpm --filter @aegis-arena/cli dev -- og status
```

What you should expect from `og status`:

- network name,
- RPC URL,
- indexer RPC URL,
- whether the runtime can use direct inference,
- whether wallet credentials are present,
- whether storage writes and fine-tuning are currently possible.

Interpretation guide:

- `canUseDirectInference: true` means a service URL is present,
- `canUseAuthenticatedCompute: true` means a private key is present for the broker path,
- `canUseStorageWrites: true` means wallet + storage settings are sufficient,
- `canRunFineTuning: true` means wallet + provider context are sufficient.

## Step 6 — Authenticate an operator Safe session in the CLI

The CLI supports three Safe owner authentication modes:

- `browser`
- `private-key`
- `ledger`

### Browser wallet flow

```bash
pnpm --filter @aegis-arena/cli dev -- login safe --safe <safe_address> --mode browser
```

### Private key flow

```bash
pnpm --filter @aegis-arena/cli dev -- login safe --safe <safe_address> --mode private-key --private-key 0x...
```

### Ledger flow

```bash
pnpm --filter @aegis-arena/cli dev -- login safe --safe <safe_address> --mode ledger --ledger-derivation-path "m/44'/60'/0'/0/0"
```

### Check the active session

```bash
pnpm --filter @aegis-arena/cli dev -- login status
```

### Clear the session if needed

```bash
pnpm --filter @aegis-arena/cli dev -- login logout
```

### Where the session is used

The local session becomes useful in two ways:

- local development can read it directly,
- the same session can be pushed into the web app so the dashboard knows which Safe identity is active.

### Ledger caveat

The repo includes Ledger support, but depending on your local native USB bindings and Node runtime, Ledger access may require rebuilding `node-hid` or using a runtime where those bindings are healthy.

## Step 7 — Publish the authenticated CLI session to the web app

Once the session exists locally, publish it to the web backend:

```bash
pnpm --filter @aegis-arena/cli dev -- login sync-web --base-url http://localhost:3000
```

What this does:

- reads the active local Safe session,
- `POST`s it to `/api/auth/cli-session`,
- lets the SPA bind dashboard state to that authenticated Safe session.

If you are using a deployed web app instead of localhost, replace the base URL:

```bash
pnpm --filter @aegis-arena/cli dev -- login sync-web --base-url https://<your-vercel-app>.vercel.app
```

## Step 8 — Seed the ETL datasets before running simulations

The web app owns ETL materialization. The ETL route is:

- `POST /api/etl/run`

This pipeline currently materializes datasets including:

- `protocols`
- `simulations`
- `epochs`
- `agent-instances`
- `rekt-incidents`
- `solodit-findings`
- `module-checks`

### Local ETL trigger

Run:

```bash
curl -X POST "http://localhost:3000/api/etl/run?source=manual"
```

What this does:

- fetches live Rekt incidents,
- fetches live Solodit findings,
- reads local protocol inventories,
- reads existing simulation artifacts,
- writes JSONL outputs under `runs/web-data/etl/datasets`.

### Why you should run ETL before the first sim

This gives the web app a baseline dataset even before any new CLI simulation is run.

### Why you should run ETL again after a sim

The simulation-generated datasets (`simulations`, `epochs`, `agent-instances`) only become current after the web ETL pipeline re-ingests the new run artifacts.

## Step 9 — Inspect 0G readiness before trying a “full OG inference” run

Run:

```bash
pnpm --filter @aegis-arena/cli dev -- og status
pnpm --filter @aegis-arena/cli dev -- og providers --detailed
```

Use these two commands to answer three questions:

1. do I have enough environment configured to attempt real 0G inference?
2. are inference providers visible?
3. do I also have enough credentials for storage/fine-tuning side flows?

### Meaning of “full OG inference” in this repo

There are really two forms of 0G-backed inference here.

#### Path A — direct provider inference

Use this when you already have:

- a provider URL,
- an API key,
- optionally a provider address.

This path is driven by:

- `AEGIS_OG_INFERENCE_SERVICE_URL`
- `AEGIS_OG_INFERENCE_API_KEY`

The client sends an OpenAI-compatible request to:

- `<service-url>/chat/completions`

#### Path B — broker-authenticated inference

Use this when you have:

- a private key on Galileo,
- enough balance,
- a provider path available via the 0G compute broker.

This path is driven by:

- `AEGIS_OG_PRIVATE_KEY`
- optional `AEGIS_OG_PROVIDER_ADDRESS`

The broker path resolves provider metadata and generates authenticated request headers before calling the provider endpoint.

### What happens when neither path is complete

The current inference client still executes the simulation shape, but it falls back to mock output if the provider call fails or credentials are incomplete.

This is useful for end-to-end smoke testing, but it is **not** the same as a real attested 0G response.

## Step 10 — Fund the account if you need broker-authenticated compute or storage writes

If you intend to use a funded wallet path, first inspect your balance:

```bash
pnpm --filter @aegis-arena/cli dev -- og balance --address <wallet_address>
```

If you need testnet funds, use the faucet helper:

```bash
pnpm --filter @aegis-arena/cli dev -- og faucet claim --address <wallet_address>
```

You can choose a provider explicitly:

```bash
pnpm --filter @aegis-arena/cli dev -- og faucet claim --address <wallet_address> --provider gcloud
pnpm --filter @aegis-arena/cli dev -- og faucet claim --address <wallet_address> --provider official
```

Practical guidance:

- `gcloud` is easier for basic token requests,
- `official` may require additional login flow,
- the command verifies balance changes over RPC and stores a local receipt.

## Step 11 — Pick a protocol inventory to simulate

This repo already includes bundled protocol inventories such as:

- `hyperbridge`
- `rhea-finance`
- `venus-protocol`
- `zerolend`
- `drift-protocol`

The simplest starting point is one protocol only.

Recommended smoke targets:

- `rhea-finance`
- `hyperbridge`

## Step 12 — Run a baseline simulation first

Before you attempt real 0G-backed inference, run a deterministic baseline:

```bash
pnpm --filter @aegis-arena/cli dev -- sim run --slug rhea-finance --episodes 1 --steps 8 --inference heuristic
```

Why:

- it confirms the simulator itself works,
- it verifies the protocol inventory is valid,
- it writes a run manifest and epoch logs,
- it helps separate simulation issues from 0G provider issues.

Artifacts created include:

- `runs/rl-sim/<run-id>/manifest.json`
- `runs/rl-sim/<run-id>/epoch-logs.jsonl`
- `runs/rl-sim/<run-id>/openenv-step-results.jsonl`

## Step 13 — Run the 0G-backed simulation mode

Once baseline simulation is healthy, attempt the 0G-backed mode:

```bash
pnpm --filter @aegis-arena/cli dev -- sim run --slug rhea-finance --episodes 1 --steps 8 --inference og-sealed
```

You can also choose a different model hint:

```bash
pnpm --filter @aegis-arena/cli dev -- sim run --slug rhea-finance --episodes 1 --steps 8 --inference og-sealed --model llama-3.3-70b-instruct
```

### What the roles are doing

Each episode cycles through these agents:

- attacker
- ciso
- defender
- judge

The simulator records:

- legal actions,
- chosen action type,
- intensity,
- inference mode,
- provider metadata,
- confidence and uncertainty,
- reward deltas,
- final exploit/detection metrics.

### What a successful 0G-backed run should look like

In the step logs you want to see an `inference` object for each action with fields like:

- `mode: "og-sealed"`
- provider information,
- signature presence,
- optional remote attestation evidence,
- confidence values.

### What a fallback run looks like

If the step log includes uncertainty like:

- `Fallback to mock inference: ...`

then the simulation ran correctly, but the provider call failed and the repo used the fallback path.

This is still useful for testing CLI → artifact → ETL → web, but it is not a proof that real provider inference succeeded.

## Step 14 — Replay the run in a human-friendly way

After a run completes, replay it:

```bash
pnpm --filter @aegis-arena/cli dev -- sim replay --run <run-id>
```

Or filter to one protocol:

```bash
pnpm --filter @aegis-arena/cli dev -- sim replay --run <run-id> --protocol rhea-finance
```

This is useful for checking:

- per-turn agent actions,
- inference metadata,
- risk/defense score changes,
- episode termination conditions.

## Step 15 — Rerun ETL after the simulation

This is the step people often forget.

After the CLI writes new run artifacts, refresh the web ETL datasets:

```bash
curl -X POST "http://localhost:3000/api/etl/run?source=manual"
```

Why this matters:

- without the second ETL pass, the web datasets do not fully reflect the new run,
- the dashboard will not show refreshed `simulations`, `epochs`, or `agent-instances` counts.

## Step 16 — Verify the web app sees the run

At this point, you should verify three layers.

### Layer A — raw CLI artifacts exist

Check that a new directory exists under:

```text
runs/rl-sim/<run-id>/
```

and contains at least:

- `manifest.json`
- `epoch-logs.jsonl`
- `openenv-step-results.jsonl`

### Layer B — ETL datasets were refreshed

Check that these files exist under:

```text
runs/web-data/etl/datasets/
```

especially:

- `simulations.jsonl`
- `epochs.jsonl`
- `agent-instances.jsonl`

### Layer C — dashboard/API layer is updated

Open the web app and confirm:

- the run appears in the run history,
- simulation counts changed,
- protocol coverage looks correct,
- ETL job history reflects the latest run.

## Step 17 — Optional: push artifacts to 0G Storage

If you have storage write credentials and balance, you can push files to 0G Storage.

### Upload the latest dataset automatically

```bash
pnpm --filter @aegis-arena/cli dev -- og storage upload
```

### Upload a specific dataset file

```bash
pnpm --filter @aegis-arena/cli dev -- og storage upload --file runs/web-data/etl/datasets/solodit-findings.jsonl
```

### Push an agent memory snapshot

```bash
pnpm --filter @aegis-arena/cli dev -- og memory push --file <path-to-memory-json>
```

### Pull a memory snapshot back down

```bash
pnpm --filter @aegis-arena/cli dev -- og memory pull --root <0g-storage-root-hash>
```

This is not required for the web dashboard to function locally, but it becomes important if you want persistent decentralized artifact anchoring.

## Step 18 — Optional: use ETL datasets for fine-tuning workflows

If you have a fine-tuning provider and enough 0G runtime configuration, you can create a fine-tuning task from a dataset:

```bash
pnpm --filter @aegis-arena/cli dev -- og fine-tuning create-task --provider <provider_address> --dataset-path runs/web-data/etl/datasets/solodit-findings.jsonl
```

This command can:

- use an already-uploaded dataset root hash, or
- upload a local dataset first and then create the task.

## Recommended complete local smoke-test sequence

If you want the shortest high-confidence path, run the following from repo root.

### 1. bootstrap the shell

```bash
export AEGIS_REPO_ROOT="$PWD"
export AEGIS_DATA_ROOT="$PWD/runs/web-data"
export AEGIS_OG_NETWORK="galileo"
export AEGIS_OG_RPC_URL="https://evmrpc-testnet.0g.ai"
export AEGIS_OG_INDEXER_RPC_URL="https://indexer-storage-testnet-turbo.0g.ai"
```

### 2. install and build

```bash
pnpm install
pnpm build
```

### 3. start the web app

```bash
pnpm --filter @aegis-arena/web dev
```

### 4. in a second terminal, inspect 0G readiness

```bash
pnpm --filter @aegis-arena/cli dev -- og status
```

### 5. authenticate a Safe session

```bash
pnpm --filter @aegis-arena/cli dev -- login safe --safe <safe_address> --mode browser
```

### 6. publish the session to the web app

```bash
pnpm --filter @aegis-arena/cli dev -- login sync-web --base-url http://localhost:3000
```

### 7. run baseline ETL

```bash
curl -X POST "http://localhost:3000/api/etl/run?source=manual"
```

### 8. run one DeFi simulation

```bash
pnpm --filter @aegis-arena/cli dev -- sim run --slug rhea-finance --episodes 1 --steps 8 --inference og-sealed
```

### 9. refresh ETL again

```bash
curl -X POST "http://localhost:3000/api/etl/run?source=manual"
```

### 10. inspect the run

```bash
pnpm --filter @aegis-arena/cli dev -- sim replay --run <run-id> --protocol rhea-finance
```

## Recommended complete “true 0G inference” sequence

Use this when you want to maximize the chance that the simulation uses a real provider instead of fallback mode.

### Path 1 — direct provider path

1. obtain a real 0G compute provider endpoint,
2. obtain an API key,
3. export:

```bash
export AEGIS_OG_INFERENCE_SERVICE_URL="https://<provider-host>/v1/proxy"
export AEGIS_OG_INFERENCE_API_KEY="app-sk-..."
```

4. verify readiness:

```bash
pnpm --filter @aegis-arena/cli dev -- og status
```

5. run:

```bash
pnpm --filter @aegis-arena/cli dev -- sim run --slug rhea-finance --episodes 1 --steps 8 --inference og-sealed
```

6. inspect the logs for absence of fallback uncertainty text.

### Path 2 — broker-authenticated path

1. fund a Galileo wallet,
2. export:

```bash
export AEGIS_OG_PRIVATE_KEY="0x..."
export AEGIS_OG_PROVIDER_ADDRESS="0x..."
```

3. verify readiness:

```bash
pnpm --filter @aegis-arena/cli dev -- og status
pnpm --filter @aegis-arena/cli dev -- og providers --detailed
```

4. run the same simulation command.

This path is closer to the native broker flow but also depends on provider availability and funding.

## Troubleshooting guide

### Problem: `og status` says direct inference is available, but `og-sealed` still falls back

Likely causes:

- the service URL is not the actual OpenAI-compatible provider endpoint,
- the provider returns `404` or another HTTP error,
- the API key is missing or invalid,
- the provider endpoint expects a different path or authorization mode.

What to do:

- verify the actual provider URL,
- verify the key format,
- retry with a confirmed provider endpoint,
- inspect the step log for the exact fallback reason.

### Problem: broker-authenticated inference fails

Likely causes:

- `AEGIS_OG_PRIVATE_KEY` is missing,
- the wallet is unfunded,
- the provider address is not valid for the selected model,
- the provider is not acknowledged or not healthy.

What to do:

- fund the wallet,
- run `og providers --detailed`,
- optionally set `AEGIS_OG_PROVIDER_ADDRESS`,
- retry the run.

### Problem: the web app does not show the new simulation

Likely causes:

- the CLI run never completed,
- the artifacts were written but ETL was not rerun,
- `AEGIS_REPO_ROOT` or `AEGIS_DATA_ROOT` points somewhere unexpected,
- you are looking at a deployed web app while the CLI wrote artifacts only to your local filesystem.

What to do:

- confirm `runs/rl-sim/<run-id>` exists,
- rerun `POST /api/etl/run`,
- check `runs/web-data/etl/datasets`,
- make sure the web app is pointed at the same artifact root you expect.

### Problem: `login sync-web` fails

Likely causes:

- no active local Safe session,
- wrong base URL,
- the web app is not running,
- the remote deployment is reachable but not configured as expected.

What to do:

- run `login status`,
- re-run `login safe`,
- verify `http://localhost:3000/api/auth/cli-session` responds.

### Problem: Ledger login does not work

Likely causes:

- the device is not unlocked,
- the Ethereum app is not open,
- native HID bindings are unhealthy in the current runtime.

What to do:

- run `pnpm --filter @aegis-arena/cli dev -- og detect-ledger --wait`,
- unlock the device and open the Ethereum app,
- if needed, rebuild the relevant native dependencies or use a known-good Node environment.

## What I recommend as the best practical path

If your goal is to prove the whole system works with the least friction, do this first:

1. run the web app locally,
2. authenticate a Safe session,
3. publish the session to the web app,
4. run ETL once,
5. run `sim run --slug rhea-finance --episodes 1 --steps 8 --inference og-sealed`,
6. rerun ETL,
7. inspect the dashboard and step logs.

If your goal is to prove **real** 0G inference rather than structural smoke testing, do the same sequence but **only after** you have either:

- a real provider URL and API key, or
- a funded broker-authenticated wallet and provider path.

Without one of those, the run still proves the repo wiring, but not true provider inference.

## Final checklist

You are done when all of the following are true:

- the CLI builds and runs,
- the web app starts locally or is reachable in deployment,
- `login safe` succeeds,
- `login sync-web` succeeds,
- `POST /api/etl/run` completes,
- `sim run` produces a new run directory,
- ETL rerun populates `simulations`, `epochs`, and `agent-instances`,
- the dashboard shows the new run,
- and, if you want true 0G inference, the step logs no longer show fallback uncertainty.
