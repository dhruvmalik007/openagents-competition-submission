# CLI Actions and Log Design

## Design Goals

The CLI is designed to do three things well:

- make data ingestion and scenario building explicit and auditable
- expose simulation and training loops in a way that maps cleanly to epochs and artifacts
- produce structured logs that are easy to store on 0G Storage and replay in reports

## Command Families

### Auth and Workspace

- `aegis login safe`
- `aegis login safe --ledger --safe <address>`
- `aegis login status`
- `aegis login logout`
- `aegis workspace init`
- `aegis workspace status`

### Source and Inventory

- `aegis sources sync rekt --year 2026`
- `aegis inventory enrich --protocol <slug>`
- `aegis inventory validate --protocol <slug>`
- `aegis inventory export --protocol <slug> --format json`

### Scenario and Agents

- `aegis scenario build --incident <incident-id>`
- `aegis scenario validate --scenario <scenario-id>`
- `aegis agent spawn <role>`
- `aegis agent inspect <agent-id>`

### Simulation and Training

- `aegis sim run --scenario <scenario-id> --episodes 20`
- `aegis sim train --scenario <scenario-id> --epochs 10`
- `aegis sim resume --run <run-id>`
- `aegis sim evaluate --run <run-id>`

### 0G and Infrastructure

- `aegis og infer --mode planner`
- `aegis og upload --path <artifact>`
- `aegis og memory sync --run <run-id>`
- `aegis og balance --address <address>`
- `aegis og faucet claim --address <address>`
- `aegis og attestation verify --run <run-id>`
- `aegis og test-plan --scenario <scenario-id>`
- `aegis kurtosis up --package packages/kurtosis/aegis-arena`
- `aegis kurtosis down --enclave <name>`

### Reporting

- `aegis report generate --run <run-id>`
- `aegis report timeline --run <run-id>`
- `aegis report export --run <run-id> --format md`

## Epoch Log Envelope

Each simulation epoch should emit a structured JSON event with:

- `runId`
- `scenarioId`
- `epoch`
- `seed`
- `agent role summaries`
- `selected 0G inference mode`
- `actions taken`
- `reward deltas`
- `detection and mitigation metrics`
- `artifact paths`
- `storage sync status`

## Recommended Log Streams

- `run.started`
- `epoch.started`
- `agent.observation`
- `agent.plan.generated`
- `agent.action`
- `environment.transition`
- `reward.computed`
- `memory.write`
- `og.inference.requested`
- `og.inference.completed`
- `epoch.completed`
- `run.completed`
- `report.completed`

## Artifact Layout

```text
runs/
  <run-id>/
    manifest.json
    epochs/
      001.trace.jsonl
      001.memory.json
      001.score.json
    reports/
      summary.md
      timeline.json
    inventory/
      protocol.json
      scenario.yaml
```

## 0G Testnet Integration Notes

The first implementation pass should target 0G Galileo testnet.

- Chain ID: `16602`
- RPC: `https://evmrpc-testnet.0g.ai`
- Explorer: `https://chainscan-galileo.0g.ai`
- Faucet: `https://faucet.0g.ai`
- Storage and DA addresses are stored in `data/networks/0g-galileo-testnet.json`

### Safe + Ledger Onboarding Notes

- Safe CLI supports hardware-owner loading through `load_ledger_cli_owners`
- the practical operator flow is: load Safe, load Ledger owner, issue Aegis session, then fund the execution account on Galileo
- at least one loaded owner needs gas to execute Safe transactions against the testnet RPC
- the live Ledger USB path additionally depends on `node-hid` building successfully for the local Node runtime

### Attestation Test Notes

- treat 0G inference verification as a two-part artifact: response signature plus remote-attestation material when surfaced by the provider path
- every run should store attestation evidence beside epoch logs instead of treating verification as an external afterthought
- attestation verification status should be promoted into the run manifest for later audit and reporting

### Preflight Toolcall Pattern

For every testnet run, fetch source-of-truth docs before execution so the scenario package captures current external assumptions.

- use `mcp_parallel_sear_web_fetch` against the 0G faucet, Galileo docs, and Safe CLI docs
- write the fetched summaries into a run-scoped `preflight/` artifact folder
- fail the preflight if the fetched docs imply changed faucet auth, changed RPC endpoints, or different Safe owner-loading steps

### Implemented Faucet Behavior

- `aegis og faucet claim` is browser-assisted because the official faucet requires login and captcha rather than exposing a simple public claim API
- the command opens the selected faucet, polls the target address over RPC, and writes a local receipt when funds arrive or the wait times out
- the command defaults to the active Safe session signer when `--address` is omitted

## Contract Inventory Resolution Strategy

The CLI should resolve protocol metadata in this order:

1. DeFiLlama protocol lookup for high-level metadata
2. official protocol docs for deployment references
3. GitHub repositories for deployment files and config
4. block explorers for verified contracts
5. manual curation when the above sources are incomplete

Every resolved address or resource should carry:

- `source`
- `confidence`
- `verified`
- optional freeform notes
