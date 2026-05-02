# 0G Hackathon Statement of Work

## Project Name

**Aegis Arena** — a CLI-first multi-agent security simulation framework for replaying and stress-testing DeFi attack scenarios on 0G.

## One-Line Description

Aegis Arena lets security teams and protocol builders ingest real 2026 DeFi incidents, enrich them with protocol metadata, spin up attacker and defender agents on 0G, and run repeatable red-team simulations inside reproducible Kurtosis environments.

## Why This Fits the 0G Prize

This project is aligned to the **0G Agent Framework, Tooling & Core Extensions** track because it is framework-level work rather than a single-purpose agent. The deliverable is a reusable developer platform with:

- a modular agent runtime built around 0G Compute and 0G Storage
- a CLI and SDK for defining, launching, and evaluating simulations
- persistent memory and scenario datasets that other builders can reuse
- at least one working example agent and one full simulation package

It also borrows ideas encouraged by the prize page:

- hierarchical planning and reflection loops
- self-improving agent workflows
- swappable memory and decision layers
- infrastructure primitives other developers can build on

## Product Thesis

Most DeFi post-mortems are static writeups. Security teams still lack a repeatable way to convert an exploit report into a multi-agent training environment where attacker tactics, defender monitoring, and response playbooks can be tested against realistic protocol state.

Aegis Arena turns exploit writeups into structured simulation episodes.

## Target Users

- protocol security teams
- founder or CISO teams running internal red-team drills
- auditors and ecosystem security researchers
- agent-framework developers who want a reusable environment similar to Gymnasium or OpenEnv, but for onchain adversarial simulations

## Primary Outcome

Deliver a working CLI application and framework that can:

1. ingest 2026 exploit cases from Rekt News
2. enrich protocol context using DeFiLlama and optional protocol metadata sources
3. store normalized scenarios and agent memory on 0G
4. orchestrate isolated simulation environments with Kurtosis
5. let a user authenticate with a Safe-controlled identity flow
6. run attacker-versus-defender simulations and score outcomes

## Scope Boundaries

### In Scope

- CLI-first developer tooling
- ETL for 2026 Rekt News incidents
- protocol enrichment using DeFiLlama APIs
- multi-agent simulation runtime
- 0G Storage for datasets, logs, and memory
- 0G Compute for inference and agent reasoning
- Kurtosis packaging for reproducible environment orchestration
- Safe-based user identity and session authorization
- one working example scenario package

### Out of Scope for Hackathon MVP

- exact byte-for-byte replay of every historical exploit on mainnet forks
- a complete contract discovery engine for every protocol in DeFi
- production-grade SOC integrations
- fully autonomous self-modifying code generation in production
- direct TTY-native Safe login without a browser handoff

## Realistic Technical Constraints

The SOW intentionally reflects current platform constraints:

- **0G Agent Skills** are best treated as infrastructure and SDK patterns for building the framework runtime, not as the finished product itself.

- **Kurtosis** is appropriate for packaging reproducible blockchain and supporting services, but not for replacing the simulation engine. It should orchestrate dependencies and isolated environments.

- **DeFiLlama** is strong for protocol metadata, TVL, chain breakdowns, fee and volume context, and entity-level enrichment. It is **not** a complete canonical source of all deployed contract addresses for every protocol. The MVP should use DeFiLlama first, then optional secondary enrichment from protocol docs, GitHub repos, explorers, or curated manifests.

- **Safe Auth Kit** is no longer the recommended path in current Safe docs. A realistic implementation is a browser-assisted sign-in flow using Safe-compatible signers and Safe SDKs, issuing a short-lived CLI session token after signature verification.

- **Rekt News** provides rich human-readable attack 
narratives. The ETL layer should normalize those narratives into structured scenario fields rather than trying to trust raw page text directly.

## CLI Product Definition

The product is a TypeScript CLI plus reusable framework package.

### Proposed Packages

- `@aegis-arena/cli` — user-facing CLI
- `@aegis-arena/core` — agent runtime, environment API, scoring
- `@aegis-arena/etl` — data ingestion and normalization
- `@aegis-arena/0g` — storage and compute adapters
- `@aegis-arena/kurtosis` — enclave and package helpers
- `@aegis-arena/scenarios` — curated simulation datasets

### Core CLI Commands

```bash
aegis init
aegis login safe
aegis sources sync rekt --year 2026
aegis sources enrich defillama --protocol aave
aegis scenario build --incident rhea-finance-2026-04-21
aegis agent spawn attacker
aegis agent spawn defender
aegis sim run --scenario rhea-finance-2026-04-21 --episodes 20
aegis sim evaluate --run <run-id>
aegis report generate --run <run-id>
aegis 0g upload --dataset incidents-2026.jsonl
aegis kurtosis up --package packages/aegis-arena
```

## User Journey

### Flow 1: Security Researcher

1. installs CLI
2. runs `aegis login safe`
3. CLI opens a companion web page
4. user signs a message with a Safe owner or delegate signer
5. backend verifies signature and maps the session to a Safe-controlled workspace
6. user syncs 2026 incidents and builds a scenario
7. user launches a simulation and exports a report

### Flow 4: Testnet Operator with Safe + Ledger

1. opens a Safe that controls the test workspace
2. loads a Ledger-backed owner through Safe CLI
3. binds the CLI session with `aegis login safe --ledger --safe <address>`
4. requests 0G Galileo faucet funds for the execution account
5. runs a short orchestration test against Galileo RPC
6. verifies response signatures and attestation artifacts for the inference path
7. persists the run manifest, auth audit, and attestation evidence to 0G-backed storage

### Flow 2: Protocol Team

1. imports a known incident template
2. swaps in their own protocol parameters and contract manifests
3. runs attacker and defender agents in Kurtosis-managed environments
4. compares policies and detection rules across repeated episodes

### Flow 3: Framework Builder

1. creates a new agent policy plugin
2. registers a custom reward function
3. publishes a scenario package and example agent in the repo

## System Architecture

### Layer 1: Ingestion and ETL

#### Inputs:

- Rekt News 2026 incident pages
- DeFiLlama protocol, TVL, fee, and entity metadata
- optional protocol docs, GitHub repos, explorer APIs, and security reports

#### Outputs:

- normalized incident records
- protocol profiles
- scenario manifests
- attacker and defender seed policies

### Layer 2: Scenario Compiler

Transforms normalized data into simulation-ready artifacts:

- attack graph
- protocol state assumptions
- actors and roles
- available actions
- defender observability limits
- reward functions
- termination conditions

### Layer 3: Agent Runtime

Agents:

- **Attacker Agent**: proposes exploit paths, reconnaissance steps, capital movements, and timing strategies
- **CISO Agent**: sets detection policy, severity thresholds, circuit breakers, and incident response goals
- **Protocol Defender Agent**: applies mitigations, pauses modules, adjusts config, and triages alerts
- **Judge or Evaluator Agent**: scores realism, success criteria, response quality, and safety improvements

### Layer 4: Environment Execution

- Kurtosis launches isolated dependencies
- chain services or mocks are brought up per scenario
- scenario state is injected
- agents act turn by turn or asynchronously
- logs, rewards, traces, and state deltas are captured

### Layer 5: Persistence on 0G

- 0G Storage KV for current scenario state and run metadata
- 0G Storage Log for event histories, transcripts, and reflections
- 0G Compute for planner, critic, and evaluator inference
- optional 0G Chain contract for provenance, run registration, or scenario NFT references

## Multi-Agent RL and Environment Model

The framework should feel familiar to users of Gymnasium and OpenEnv while staying practical for a hackathon.

### Environment API

```text
reset(scenario_id, seed) -> observation
step(agent_id, action) -> observation, reward, done, info
render(run_id) -> timeline or report
score(run_id) -> benchmark metrics
```

### Observation Space

- protocol profile
- known contracts and roles
- current balances and TVL context
- event stream
- active alerts
- previous actions
- hidden attacker information depending on role

### Action Space

Attacker examples:

- reconnaissance
- propose exploit path
- craft transaction sequence
- social engineering attempt
- bridge or mixer exit path
- timing and sequencing choice

Defender examples:

- freeze or pause module
- raise alert severity
- rotate keys or invalidate permissions
- adjust monitoring policy
- publish user warning
- trigger emergency governance path

### Reward Model

Attacker reward:

- exploit success
- capital extraction
- stealth
- time to completion
- defender confusion

Defender reward:

- time to detection
- funds preserved
- blast radius reduction
- false-positive control
- recovery quality

Shared system score:

- whether the simulation produced an actionable mitigation
- whether the post-run analysis improved the protocol playbook
- reproducibility of the outcome across seeds

### Learning Loop

For hackathon MVP, implement **policy iteration over prompts, heuristics, and memory**, not heavyweight distributed RL training. That means:

- agent policy templates
- reflection after each episode
- evaluator feedback
- updated tool selection weights or prompt configuration
- persistent memory stored on 0G between runs

This satisfies the spirit of a self-improving multi-agent framework without overscoping into full RL infrastructure.

## Safe Wallet Login Design

Because this is a CLI product, authentication must be realistic.

### Recommended MVP Approach

- `aegis login safe` opens a browser session
- user authenticates with a Safe-compatible signer flow
- backend verifies signed challenge and Safe ownership or delegation
- CLI receives a short-lived access token tied to the workspace
- privileged actions such as publishing scenario results or registering runs require the active session

### Why This Approach

- works with Safe’s current SDK direction
- avoids pretending the CLI can directly control a multisig wallet in a simple local terminal flow
- supports team-owned workspaces, which fits protocol security teams better than single-wallet auth

### Stretch Goal

Add Safe transaction proposal support so simulation outcomes can generate executable remediation proposals for review.

## ETL Design for 2026 Incidents

### Phase A: Source Collection

From Rekt News:

- crawl index pages until entries are outside 2026
- fetch article pages for every 2026 exploit
- capture title, date, slug, protocol, loss amount, chain, root cause, exploit class, named actors, and raw narrative

From DeFiLlama:

- lookup protocol slug and category
- fetch TVL and chain breakdowns
- fetch fee, volume, and revenue context when available
- fetch entity, raises, and hack metadata where available
- store official URLs, governance IDs, token metadata, and known addresses returned by the API

From secondary enrichment sources:

- protocol docs and GitHub
- explorer-verified contracts
- audit reports
- public incident post-mortems

### Phase B: Normalization

Normalize each incident into a schema like:

```json
{
  "incident_id": "rhea-finance-2026-04-21",
  "title": "Rhea Finance - Swap Route Exploitation",
  "published_at": "2026-04-21",
  "protocol_name": "Rhea Finance",
  "protocol_slug": "rhea-finance",
  "chains": ["NEAR"],
  "loss_usd": 18400000,
  "attack_type": ["input-validation-failure", "collateral-manipulation"],
  "actors": ["unknown-attacker"],
  "source_urls": [],
  "narrative": "...",
  "protocol_context": {
    "category": "DEX",
    "tvl": null,
    "official_urls": [],
    "known_addresses": []
  },
  "scenario_hypotheses": [],
  "confidence": {
    "root_cause": "medium",
    "actors": "low",
    "addresses": "low"
  }
}
```

### Phase C: Scenario Compilation

For each incident generate:

- `scenario.yaml`
- `contracts.json`
- `actors.json`
- `reward-config.json`
- `defender-playbook.md`

## Data Quality Rules

- every claim keeps source URLs
- every field has a confidence level
- inferred fields are marked as inferred
- missing contract addresses are allowed and do not block scenario creation
- scenarios can be run in `narrative-mode` without full chain replay
- only a smaller curated subset should be upgraded to `stateful-mode` with richer environment simulation

## Two Execution Modes

### 1. Narrative Mode

Fastest for hackathon delivery.

- no full chain replay required
- agents operate on structured incident state and event abstractions
- useful for prompt-policy evaluation and red-team reasoning

### 2. Stateful Mode

Higher fidelity for selected incidents.

- uses Kurtosis to launch supporting services and mocks
- optional chain fork or protocol-specific mock services
- contracts and balances represented more explicitly

The MVP should ship with Narrative Mode for all 2026 incidents and Stateful Mode for 1 to 2 flagship scenarios.

## Proposed Example Scenario Set

Start with a curated subset of 2026 entries that represent different exploit classes:

- social engineering or key compromise
- oracle or price manipulation
- input validation failure
- governance or permission abuse
- bridge or routing exploitation

This gives stronger framework coverage than trying to ingest and perfectly replay every case before demo day.

## Precise Feature Backlog

### Track A: Core Framework

- define environment API
- implement agent registry and policy interface
- implement episode runner and scoring engine
- implement reflection memory adapter for 0G Storage
- implement evaluator agent using 0G Compute

### Track B: CLI

- project bootstrap command
- Safe login command with browser handoff
- source sync commands
- scenario build and validation commands
- simulation run and report commands
- 0G upload and download helpers
- Kurtosis environment management commands

### Track C: ETL

- Rekt News crawler for 2026 pages
- article parser and schema extractor
- DeFiLlama enrichment client
- secondary enrichment adapters
- dataset validator and deduplication
- JSONL and YAML exporters

### Track D: Simulation Content

- initial scenario ontology
- attacker action taxonomy
- defender action taxonomy
- reward functions
- benchmark metrics
- curated example agents

### Track E: Infra and Packaging

- Kurtosis package definition
- local development compose or fallback setup
- environment templates
- run artifact persistence to 0G
- optional onchain registry contract for simulation provenance

## Deliverables for Hackathon Submission

### Required Deliverables

- project name and short description
- public GitHub repo with setup instructions
- demo video under 3 minutes
- live demo or runnable CLI walkthrough
- explanation of 0G features and SDKs used
- team member names and contact info
- at least one working example agent
- architecture diagram

### Recommended Concrete Submission Artifacts

- `README.md` with install and quickstart
- `docs/architecture.md`
- `docs/scenarios/rhea-finance.md`
- `examples/agents/defender-basic.ts`
- `examples/agents/attacker-basic.ts`
- `packages/kurtosis/aegis-arena/`
- `data/incidents/rekt-2026.jsonl`
- `contracts/SimulationRegistry.sol` or similar optional provenance contract

## Milestones

### Milestone 1: Foundation

- scaffold mono-repo or workspace
- wrap 0G SDK access patterns
- define CLI and package boundaries
- choose incident schema

### Milestone 2: ETL MVP

- ingest 2026 Rekt News incidents
- enrich with DeFiLlama protocol data
- export validated normalized dataset

### Milestone 3: Simulation MVP

- implement environment API
- ship attacker, defender, evaluator agents
- support Narrative Mode end-to-end

### Milestone 4: Kurtosis and 0G Integration

- package reproducible environment
- persist runs, logs, and memory to 0G
- use 0G Compute for core reasoning loops

### Milestone 5: Demo Polish

- add Safe login flow
- produce one flagship stateful scenario
- generate architecture diagram and benchmark report

## Acceptance Criteria

The MVP is successful if all of the following are true:

- a user can authenticate into the CLI through a Safe-backed flow
- the CLI can ingest at least 5 to 10 curated 2026 incidents from Rekt News
- each incident is enriched with DeFiLlama metadata where available
- a user can compile at least one incident into a runnable scenario
- attacker and defender agents can run for multiple episodes
- runs produce logs, scores, and reflection output stored on 0G
- Kurtosis can launch the supporting environment for at least one demo scenario
- the repo includes at least one working example agent and one architecture diagram

## Risks and Mitigations

### Risk: Contract address coverage is incomplete

Mitigation:

- allow partial scenarios
- use secondary enrichment sources
- maintain curated manifests for flagship demos

### Risk: Full exploit replay is too heavy

Mitigation:

- prioritize narrative-mode simulations
- stateful mode only for selected incidents

### Risk: Safe login becomes a UX bottleneck

Mitigation:

- use browser-assisted challenge flow
- support a local developer fallback signer for non-production demos

### Risk: 0G integration consumes too much build time

Mitigation:

- use 0G Storage first for persistence
- use one 0G Compute-backed evaluator or planner in MVP
- avoid building custom infrastructure beyond what the 0G SDK already supports

## Recommended Demo Story

1. login with Safe
2. sync 2026 Rekt incidents
3. build one scenario from a real exploit
4. show the attacker and defender agents running
5. show reflection memory persisted to 0G
6. show Kurtosis spinning the environment for the flagship scenario
7. end with a report listing mitigations and protocol improvements

## Final Build Recommendation

To maximize your chance at the 0G framework prize, position Aegis Arena as:

- A robust simulation framework for simulating the professional red-teaming environments.

- A CLI and web based application that lets the users to simulate the agent (with the initial prompt defining the )
- a 0G-native memory and inference substrate
- a Kurtosis-packaged environment runner
- a dataset pipeline that converts real incidents into benchmarkable agent tasks

That framing is stronger than pitching it only as an exploit replay tool. It makes the project clearly framework-level, reusable by other teams, and directly aligned to the prize language.

## Immediate Next Implementation Tasks

1. [X] scaffold the TypeScript monorepo and CLI commands
2. [ ] Implement the Rekt News 2026 crawler and normalized incident schema
3. [ ] Add data pipeline framework (ETL with well defined structured format):
    -  [ ] DeFiLlama liquidity ( in order to test the current liquidity parameters in the case of the particular attack). 
    - [ ] Rekt news for the detailed format of the previous attack vectors with the .
    - [ ] Other web3 competition auditing firms (solodit, sherlock, cantina and other architecture)

4.  [ ] Define the API (openenv kind of interactive environment) along with the implementation of the  .
5. [ ] Wire 0G Storage adapters for datasets and run logs
6.  [X] Add the wallet login ( either Safe/ browser-login compatible) workflow.

7.  [ ] Package the flagship demo offchain operations with kurtosis (both the indexers / offchain infras, custody, human or ai agents ) based on the given specification of the infrastructure scenario provided by the entity.

8. [ ] Also create the web page application in order to showcase the simulation setup, login, results, inferrence trace observability and other things.