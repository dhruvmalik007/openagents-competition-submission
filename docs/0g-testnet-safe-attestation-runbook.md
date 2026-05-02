# 0G Testnet Safe + Attestation Runbook

This runbook defines the detailed format for integrating and testing Aegis Arena on 0G Galileo testnet with:

- Safe-based operator identity,
- Ledger-backed owner onboarding,
- testnet faucet funding,
- multi-agent orchestration,
- and attestation-oriented inference validation.

## Why This Runbook Exists

The test flow needs to validate more than just RPC connectivity.

A complete Galileo smoke test for Aegis Arena should prove that:

1. an operator can authenticate through a Safe-controlled identity,
2. a Ledger-backed owner can be used for Safe-side approvals,
3. the execution account can be funded on Galileo,
4. the orchestration layer can run a short multi-agent scenario,
5. inference outputs can be archived with verification evidence,
6. artifacts can be persisted for later audit.

## Canonical Network Targets

Use Galileo as the default network for the first end-to-end pass.

- Network: `0G-Galileo-Testnet`
- Chain ID: `16602`
- RPC: `https://evmrpc-testnet.0g.ai`
- Explorer: `https://chainscan-galileo.0g.ai`
- Faucet: `https://faucet.0g.ai`

## Source-of-Truth Preflight

Before each orchestration run, refresh external assumptions with `mcp_parallel_sear_web_fetch`.

### Required fetch set

- `https://docs.0g.ai/`
- `https://faucet.0g.ai/`
- `https://0g.ai/blog/introducing-v3-testnet-galileo`
- `https://docs.safe.global/advanced/cli-reference/common-commands`

### Toolcall format

Use a preflight fetch like this:

```json
{
  "urls": [
    "https://docs.0g.ai/",
    "https://faucet.0g.ai/",
    "https://0g.ai/blog/introducing-v3-testnet-galileo",
    "https://docs.safe.global/advanced/cli-reference/common-commands"
  ],
  "objective": "Extract current Galileo RPC and faucet assumptions, plus Safe CLI Ledger-owner onboarding steps for Aegis Arena testnet runs."
}
```

### Preflight acceptance rules

The run must stop and mark preflight as failed if any of the following are true:

- the Galileo RPC or chain identity differs from the repo defaults,
- the faucet no longer supports the expected browser login/request path,
- Safe CLI changes the Ledger owner-loading flow,
- a required external endpoint is unavailable.

### Preflight artifacts

Write the fetched summaries to:

```text
runs/<run-id>/preflight/
  0g-docs.json
  faucet.json
  safe-cli.json
  assumptions.md
```

## Safe + Ledger Onboarding Format

The operator identity model should be split into two layers:

- **Safe identity**: durable workspace owner and policy anchor
- **execution signer**: the funded account that actually sends Galileo transactions

The execution signer can be:

- a direct Safe owner EOA,
- a delegate used for test execution,
- or a Safe-mediated account abstraction path later on.

### Safe CLI bootstrap

Load the Safe against the Galileo RPC:

```bash
safe-cli <checksummed_safe_address> https://evmrpc-testnet.0g.ai
```

### Ledger owner loading

Safe CLI documents Ledger support via the hardware-wallet module.

Install the Ledger extras:

```bash
pip install "safe-cli[ledger]"
```

Load a Ledger owner:

```bash
load_ledger_cli_owners --derivation-path "m/44'/60'/0'/0/0"
```

If the derivation path is not pinned ahead of time, the operator should inspect the presented account list and select the owner that already belongs to the Safe.

### Aegis session binding

Aegis should model the operator login step as:

```bash
aegis login safe --ledger --safe <safe_address>
```

Expected outputs:

- session token,
- Safe workspace binding,
- Ledger-owner fingerprint,
- auth audit record.

## Implemented MVP Login Modes

The current CLI implementation supports three owner-authentication paths against a Safe on an EVM RPC:

- `browser` — starts a temporary localhost page, asks an injected wallet to sign an Aegis challenge, then verifies the recovered signer is a Safe owner
- `private-key` — signs the same challenge directly from a provided EOA private key and verifies Safe ownership
- `ledger` — attempts to read an address and sign the challenge through a USB Ledger device, then verifies Safe ownership

### Example commands

Browser wallet:

```bash
aegis login safe --safe <safe_address> --mode browser
```

Private key:

```bash
aegis login safe --safe <safe_address> --mode private-key --private-key 0x...
```

Ledger:

```bash
aegis login safe --safe <safe_address> --mode ledger --ledger-derivation-path "m/44'/60'/0'/0/0"
```

Session inspection:

```bash
aegis login status
aegis login logout
```

### Current MVP constraint

The implemented flow verifies **Safe owners** onchain through `getOwners()` and `getThreshold()`.

That means:

- Safe owner EOAs work now,
- browser wallets work when the connected account is an owner,
- private-key login works when that key controls an owner EOA,
- Ledger works when the selected Ledger address is an owner,
- offchain delegate or module-based Safe authorization is not implemented yet.

### Current Ledger runtime blocker

The CLI code for Ledger signing is implemented, but live USB execution in this environment is currently blocked by a missing native `node-hid` binding (`HID.node`) under the active Node 24 runtime.

That is a local runtime/build issue, not a missing CLI feature.

## Testnet Funding Format

After identity binding, fund the execution account.

### Funding path

1. open `https://faucet.0g.ai/`
2. authenticate using the faucet’s required login flow,
3. request 0G tokens for the execution address,
4. verify the balance before simulation starts.

### CLI-facing abstraction

The repo should treat this as:

```bash
aegis og faucet claim --address <execution_address>
```

Balance inspection helper:

```bash
aegis og balance --address <execution_address>
```

Expected artifacts:

- faucet request timestamp,
- funded address,
- explorer link,
- post-funding balance snapshot.

### Implemented faucet mode

The current faucet command is browser-assisted and RPC-verified:

1. resolve the target address from `--address` or the active Safe session,
2. open the official 0G faucet or Google Cloud faucet,
3. let the operator complete login, wallet entry, and captcha,
4. poll the target address balance over Galileo RPC,
5. persist a local faucet receipt JSON file.

### Funding success criteria

A run is considered funded only when there is enough 0G to cover:

- at least one Safe-mediated test transaction,
- one short orchestration run,
- one storage sync or artifact anchor transaction if used.

## Multi-Agent Orchestration Format

The minimal integration test should use a short scenario and bounded episode count.

### Minimal smoke configuration

- scenario: one bundled incident such as `hyperbridge` or `rhea-finance`
- roles: `attacker`, `defender`, `judge`
- episodes: `1-3`
- inference mode: `planner` or `evaluator`
- persistence: enabled
- attestation capture: enabled

### Suggested run sequence

1. validate inventory
2. render Kurtosis package
3. boot enclave services
4. inject Galileo RPC and Safe session context
5. run one short scenario
6. persist artifacts
7. verify attestation evidence

### Example command sequence

```bash
aegis inventory enrich --protocol hyperbridge
aegis infra kurtosis render --scenario hyperbridge-2026-04-15
aegis sim run --scenario hyperbridge-2026-04-15 --episodes 1
```

## Attestation Testing Format

Public 0G Sealed Inference material now describes two proof surfaces:

- per-response signatures,
- downloadable remote attestation reports.

Aegis should therefore treat attestation validation as an artifact collection and verification step, not as a vague boolean.

### Required attestation artifacts

For each inference-backed evaluation path, store:

- request identifier,
- model/provider identifier,
- signed response payload or signature reference,
- remote attestation report when available,
- verification result,
- failure reason if unavailable.

### Repo artifact layout

```text
runs/<run-id>/attestation/
  provider.json
  response-signatures.jsonl
  remote-attestation-report.json
  verification-summary.json
```

### CLI-facing validation step

```bash
aegis og attestation verify --run <run-id>
```

Expected outputs:

- attestation report,
- signature summary,
- verification status.

### Verification result classes

Use one of these statuses:

- `verified`
- `signature-only`
- `report-missing`
- `verification-failed`

This matters because Galileo testing may precede a fully stable public attestation API for every provider path.

## Toolcall-Supported Test Harness Pattern

When a run starts, the orchestrator should use external toolcalls only in controlled preflight and enrichment phases.

### Recommended policy

- use `mcp_parallel_sear_web_fetch` for doc and endpoint validation,
- keep fetched outputs under `preflight/` or `sources/`,
- do not let ad-hoc web fetches mutate core run state mid-episode,
- freeze the fetched assumptions for the duration of a single run.

### Good use of `mcp_parallel_sear_web_fetch`

- current faucet behavior,
- current Safe CLI Ledger flow,
- protocol docs required for scenario enrichment,
- 0G builder docs relevant to storage or compute setup.

### Bad use during a live episode

- changing attack assumptions mid-run,
- replacing already-compiled scenario state,
- silently altering reward configuration based on late fetches.

## End-to-End Acceptance Checklist

A Galileo smoke test passes only if all of the following are true:

- preflight fetch succeeds and is archived,
- Safe is loaded and a Ledger owner is available,
- execution address receives faucet funds,
- the scenario runs at least one epoch,
- 0G-backed inference is invoked at least once,
- attestation or signature evidence is archived,
- run artifacts are written and indexed.

## Recommended Next Implementation Steps

1. add a persisted session model for `aegis login safe --ledger`
2. add a balance check command for Galileo-funded execution accounts
3. add a run-manifest attestation section
4. add a storage uploader for `preflight/` and `attestation/` artifacts
5. add a CI-safe dry-run mode that skips real faucet claims but validates the rest of the flow
