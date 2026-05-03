# End-to-End Testing Guide: Wallet Profile + Multi-Agent Simulation

This guide walks through testing the complete Aegis Arena workflow: creating a user profile with wallet authentication, seeding ETL data, initializing agents, and running multi-agent simulations with result evaluation.

## Prerequisites

### System Requirements
- macOS, Linux, or WSL2 (with Docker)
- Node.js 20.x+
- pnpm 10.x+
- Git
- POSIX shell (bash/zsh)

### Environment Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/aegis-arena/openagents_autoresearch
   cd openagents_autoresearch
   ```

2. Install dependencies:
   ```bash
   pnpm install
   pnpm build
   ```

3. Verify the CLI is working:
   ```bash
   pnpm --filter @aegis-arena/cli dev -- --help
   ```

### 0G Galileo Testnet Setup
You'll need testnet credentials and some balance.

1. **Get Galileo Testnet RPC:**
   - RPC URL: `https://evmrpc-testnet.0g.ai`
   - Chain ID: 16602
   - Faucet: `https://faucet.0g.ai`

2. **Fund a test wallet** (you'll use this in the profile creation step):
   - Navigate to `https://faucet.0g.ai`
   - Enter your wallet address
   - Claim some tokens (~0.1 0G is sufficient)
   - Verify balance via RPC

---

## Phase 1: Create a User Profile with Wallet Authentication

This phase authenticates a user wallet and creates a persisted user profile on 0G Storage.

### Step 1.1: Choose Your Authentication Method

The CLI supports three Safe signer modes:

#### Option A: Browser-based wallet (Recommended for first-time testing)

```bash
# Start the CLI in dev mode with browser authentication
pnpm --filter @aegis-arena/cli dev -- login safe \
  --safe 0x1234...5678 \
  --mode browser
```

**What happens:**
1. CLI launches a temporary localhost signing page on `http://localhost:3000`
2. Your browser opens automatically
3. You connect your wallet (MetaMask, WalletConnect, etc.)
4. You sign a challenge message
5. CLI verifies the signature against the Safe
6. Session token is generated and stored locally

**File outputs:**
- `.aegis-arena/sessions/{sessionId}.json` — Session metadata
- `.aegis-arena/profiles/{walletAddress}.json` — User profile stub

#### Option B: Direct private key (Dev/testing only)

```bash
# WARNING: Never use mainnet keys!
# Only use for isolated Galileo testnet accounts
pnpm --filter @aegis-arena/cli dev -- login safe \
  --safe 0x1234...5678 \
  --private-key 0xabcd...ef01 \
  --mode private-key
```

**Output:**
- Session and profile files as above

#### Option C: USB Ledger (Hardware wallet signing)

```bash
pnpm --filter @aegis-arena/cli dev -- login safe \
  --safe 0x1234...5678 \
  --mode ledger
```

**Prerequisites:**
- Ledger device connected via USB
- Ledger Live closed (to avoid conflicts)
- Ethereum app installed on Ledger
- Your Safe owner address derivable from Ledger

**Output:**
- Session and profile files as above

### Step 1.2: Verify Profile Creation

After login, check the generated profile:

```bash
# List all cached sessions
ls -la ~/.aegis-arena/sessions/

# View your profile
cat ~/.aegis-arena/profiles/$(whoami)-wallet-profile.json
```

**Expected profile structure:**
```json
{
  "walletAddress": "0x...",
  "safeAddress": "0x...",
  "createdAt": "2026-05-02T12:34:56Z",
  "signerMode": "browser|private-key|ledger",
  "sessionId": "sess_abc123def456",
  "sessionToken": "eyJhbGc...",
  "vectorMemoryEndpoint": "https://vector-store.0g.ai/user/...",
  "storagePath": "0g://user-data/profiles/0x.../",
  "agentContext": {
    "role": "operator",
    "permissions": ["read", "write", "simulate"]
  }
}
```

### Step 1.3: Sync Profile to Web Control Plane (Optional)

If you have the web app running locally, publish your profile:

```bash
# Ensure web app is running in another terminal
# pnpm --filter @aegis-arena/web dev

# From CLI, sync your profile to the web control plane
pnpm --filter @aegis-arena/cli dev -- login sync-web \
  --base-url http://localhost:3000
```

**What happens:**
1. CLI uploads session token to web backend
2. Web backend validates token signature
3. Profile appears in web dashboard
4. Vector memory store is initialized for the user

### Step 1.4: Fast packaged workflow for demos

If you want to demonstrate the whole path using the packaged CLI instead of invoking each command manually, use one of these:

```bash
# End-to-end login + sync + ETL refresh + simulation run
aegis workflow run \
  --safe 0x1234...5678 \
  --base-url https://aegis-0g-openagents-hackathon.vercel.app \
  --mode browser \
  --inference og-mock \
  --episodes 1 \
  --steps 8 \
  --slug rhea-finance

# End-to-end login + sync + ETL refresh + policy training
aegis workflow train \
  --safe 0x1234...5678 \
  --base-url https://aegis-0g-openagents-hackathon.vercel.app \
  --mode browser \
  --inference og-mock \
  --rounds 2 \
  --variants 3 \
  --episodes 1 \
  --steps 8 \
  --slug rhea-finance
```

These workflow commands do four things in sequence:

1. authenticate the Safe owner and persist the local CLI session,
2. sync the session to the web control plane,
3. trigger the remote ETL refresh route,
4. run either the simulation or the GRPO-based training loop with the selected 0G-backed inference mode.

---

## Phase 2: Seed ETL Data from 0G Storage

This phase downloads pre-processed DeFi incident data from 0G Storage and materializes it locally for simulation.

### Step 2.1: Understand the ETL Data Model

The ETL pipeline processes:
- **Incidents**: 2026 DeFi attack cases from Rekt News
- **Protocols**: Target protocol metadata (chain, contracts, roles)
- **Epochs**: Historical blockchain state snapshots
- **Agents**: Pre-trained agent policies (attacker, defender, CISO, judge)

All data is stored as JSONL (one JSON object per line) for streaming efficiency.

### Step 2.2: Fetch ETL Datasets

**Option A: Fetch from 0G Storage (default)**

```bash
pnpm --filter @aegis-arena/cli dev -- etl fetch \
  --dataset-type incidents \
  --output runs/web-data/etl/datasets/incidents.jsonl
```

**Output:**
```
✓ Fetching incidents dataset from 0G Storage...
✓ Downloaded 127 incidents (2026-02-01 to 2026-04-30)
✓ Saved to runs/web-data/etl/datasets/incidents.jsonl (4.2 MB)
```

**Repeat for all dataset types:**

```bash
pnpm --filter @aegis-arena/cli dev -- etl fetch --dataset-type protocols
pnpm --filter @aegis-arena/cli dev -- etl fetch --dataset-type epochs
pnpm --filter @aegis-arena/cli dev -- etl fetch --dataset-type agents
```

**Option B: Use local seed data (for offline testing)**

```bash
# Check if seed data exists
ls -la data/etl-seeds/

# Copy seed data to runtime location
cp data/etl-seeds/incidents.jsonl runs/web-data/etl/datasets/
cp data/etl-seeds/protocols.jsonl runs/web-data/etl/datasets/
cp data/etl-seeds/epochs.jsonl runs/web-data/etl/datasets/
cp data/etl-seeds/agents.jsonl runs/web-data/etl/datasets/
```

### Step 2.3: Validate ETL Data

```bash
# Count records in each dataset
wc -l runs/web-data/etl/datasets/*.jsonl

# Inspect a single incident record
head -1 runs/web-data/etl/datasets/incidents.jsonl | jq .

# Expected incident structure:
{
  "id": "rekt-2026-02-15",
  "title": "Drift Protocol Flash Loan Attack",
  "protocol": "drift-protocol",
  "chain": "solana",
  "date": "2026-02-15T14:32:00Z",
  "lossUSD": 5200000,
  "vectorEmbedding": [...],
  "attackVector": "flash-loan-liquidation",
  "defendersResponded": ["drift-team", "chainlink-oracles"]
}
```

### Step 2.4: Enrich Protocol Metadata

The ETL also downloads protocol contract addresses and state from DeFiLlama:

```bash
pnpm --filter @aegis-arena/cli dev -- etl enrich-protocols \
  --source defilamma \
  --output runs/web-data/etl/datasets/protocols-enriched.jsonl
```

**Output:**
```
✓ Querying DeFiLlama API for 28 protocols...
✓ Enriched with current TVL, chain deployments, contract ABIs
✓ Saved enriched metadata to protocols-enriched.jsonl
```

---

## Phase 3: Initialize Multi-Agent Simulation Environment

This phase prepares the simulation runtime with agents, policies, and protocol environments.

### Step 3.1: Understand the Agent Architecture

Aegis Arena simulations include four cooperative agents:

| Agent | Role | Action Space | Reward Signal |
|-------|------|--------------|---------------|
| **Attacker** | Exploit finder | craft-exploit, escalate-attack, cover-tracks | +reward for successful exploit, -penalty for detection |
| **CISO** | Alert escalator | enable-guardrails, alert-team, adjust-permissions | +reward for early detection, +reward for containment |
| **Defender** | Incident responder | isolate-asset, quarantine-asset, block-attacker | +reward for mitigation, +penalty for false alarms |
| **Judge** | Trajectory scorer | score-trajectory, validate-defense | +reward for fair scoring, penalty for incorrect assessment |

Each agent's policy is pre-trained using reinforcement learning (RL Policy package).

### Step 3.2: Load Agent Policies

```bash
# Build the RL policy package (contains trained agent models)
pnpm --filter @aegis-arena/rl-policy build

# Verify policies are compiled
ls -la packages/rl-policy/dist/policies/

# Load policies into simulation memory
pnpm --filter @aegis-arena/cli dev -- sim load-policies \
  --agent-set default \
  --checkpoint latest
```

**Output:**
```
✓ Loading RL Policy package...
✓ Policy [attacker-v2.4]: 1.2M params
✓ Policy [ciso-v1.8]: 0.8M params
✓ Policy [defender-v3.1]: 1.5M params
✓ Policy [judge-v1.3]: 0.6M params
✓ Total model size: 4.1M
```

### Step 3.3: Initialize the Simulation Runtime

```bash
# Initialize a new simulation run with specific configurations
pnpm --filter @aegis-arena/cli dev -- sim init \
  --run-name "E2E Test Run - Profile Auth" \
  --protocols drift-protocol,uniswap,aave \
  --episodes-per-protocol 1 \
  --max-steps 10 \
  --seed 42
```

**What happens:**
1. CLI generates a unique `runId` (e.g., `2026-05-02T12-34-56-789Z-abc123def`)
2. Creates directory: `runs/rl-sim/{runId}/`
3. Initializes manifest with protocols, episode count, random seed
4. Loads ETL data into runtime memory
5. Creates agent instances with loaded policies

**Output structure:**
```
runs/rl-sim/2026-05-02T12-34-56-789Z-abc123def/
├── manifest.json                # Run metadata
├── openenv-step-results.jsonl  # Live simulation log
├── protocols/
│   ├── drift-protocol/
│   │   ├── episode-0-state.json
│   │   └── ...
│   ├── uniswap/
│   └── aave/
└── agent-traces/
    ├── attacker-trajectory.jsonl
    ├── ciso-trajectory.jsonl
    ├── defender-trajectory.jsonl
    └── judge-trajectory.jsonl
```

### Step 3.4: Inspect Simulation Configuration

```bash
# View the run manifest
cat runs/rl-sim/2026-05-02T12-34-56-789Z-abc123def/manifest.json | jq .

# Expected manifest:
{
  "runId": "2026-05-02T12-34-56-789Z-abc123def",
  "createdAt": "2026-05-02T12:34:56.789Z",
  "createdBy": "0x...",
  "config": {
    "protocols": ["drift-protocol", "uniswap", "aave"],
    "episodesPerProtocol": 1,
    "maxStepsPerEpisode": 10,
    "randomSeed": 42,
    "policyCheckpoint": "latest"
  },
  "agents": {
    "attacker": { "policy": "attacker-v2.4", "params": 1200000 },
    "ciso": { "policy": "ciso-v1.8", "params": 800000 },
    "defender": { "policy": "defender-v3.1", "params": 1500000 },
    "judge": { "policy": "judge-v1.3", "params": 600000 }
  },
  "status": "initialized",
  "progress": { "episodes": 0, "steps": 0 }
}
```

---

## Phase 4: Execute Multi-Agent Simulation

This phase runs the actual simulation, where agents interact with protocol environments and make decisions.

### Step 4.1: Start the Simulation Run

```bash
# Execute the simulation (this will take a few seconds to minutes)
pnpm --filter @aegis-arena/cli dev -- sim run \
  --run 2026-05-02T12-34-56-789Z-abc123def \
  --verbose
```

**Console output example:**
```
🚀 Starting simulation run: 2026-05-02T12-34-56-789Z-abc123def
📋 Protocols: drift-protocol, uniswap, aave (3 total)
🎬 Episodes per protocol: 1
⏱️  Max steps per episode: 10

🔄 PROTOCOL: drift-protocol ==========================================

[Episode 0] Initializing episode...
- Risk Score: 0.500 (baseline)
- Defense Score: 0.500 (baseline)
- Detection Confidence: 0.500 (baseline)

[Episode 0 / Step 1] Attacker decision...
  → Action: craft-exploit (intensity: 0.42)
  → Risk: 0.500 → 0.548
  → Reward: +0.323
  → Next agent: CISO

[Episode 0 / Step 2] CISO decision...
  → Action: enable-guardrails (intensity: 0.49)
  → Defense: 0.500 → 0.629
  → Detection: 0.500 → 0.549
  → Reward: +0.633
  → Next agent: Defender

...

[Episode 0] Episode TERMINATED at step 4
  ├─ Final Risk: 0.486
  ├─ Final Defense: 0.502
  ├─ Final Detection: 0.645
  └─ Episode Reward: +2.353

✅ drift-protocol complete (1/3 protocols)
...

🔄 PROTOCOL: uniswap ================================================
...

✅ SIMULATION COMPLETE
Total runtime: 47 seconds
Total episodes: 3 (drift, uniswap, aave)
Total steps: 27
Average reward per episode: 2.104
```

### Step 4.2: Monitor the Simulation Log

While the simulation is running (or after), you can stream the live log:

```bash
# Tail the JSONL log in real-time
tail -f runs/rl-sim/2026-05-02T12-34-56-789Z-abc123def/openenv-step-results.jsonl | jq .

# Example log entries:
# {"event": "openenv.reset", "step": 0, "episode": 0, "protocol": "drift-protocol", "state": {...}}
# {"event": "openenv.step", "step": 1, "episode": 0, "protocol": "drift-protocol", "agent": "attacker", "action": "craft-exploit", "intensity": 0.42, "state": {...}, "reward": 0.323}
# {"event": "openenv.step", "step": 2, "episode": 0, "protocol": "drift-protocol", "agent": "ciso", "action": "enable-guardrails", "intensity": 0.49, "state": {...}, "reward": 0.633}
# ...
# {"event": "openenv.state", "episode": 0, "protocol": "drift-protocol", "terminated": true, "truncated": false, "final_state": {...}}
```

### Step 4.3: Check Agent Trajectories

Agents' decision traces are logged separately for analysis:

```bash
# View attacker's action sequence
cat runs/rl-sim/2026-05-02T12-34-56-789Z-abc123def/agent-traces/attacker-trajectory.jsonl | jq '.'

# Example attacker trajectory:
[
  {"step": 1, "protocol": "drift-protocol", "episode": 0, "action": "craft-exploit", "intensity": 0.42, "risk_delta": +0.048, "reward": +0.323},
  {"step": 5, "protocol": "uniswap", "episode": 0, "action": "escalate-attack", "intensity": 0.63, "risk_delta": +0.051, "reward": +0.412},
  ...
]
```

---

## Phase 5: Analyze and Replay Results

This phase visualizes simulation results and evaluates agent performance.

### Step 5.1: Replay a Single Episode

```bash
# Replay all episodes from the run
pnpm --filter @aegis-arena/cli dev -- sim replay \
  --run 2026-05-02T12-34-56-789Z-abc123def

# Or replay a specific protocol
pnpm --filter @aegis-arena/cli dev -- sim replay \
  --run 2026-05-02T12-34-56-789Z-abc123def \
  --protocol drift-protocol
```

**Output example:**
```
╔════════════════════════════════════════════════════════════════╗
║  Episode: drift-protocol-0000                                   ║
╚════════════════════════════════════════════════════════════════╝

📊 INITIAL STATE (Reset)
   Risk Score:             0.510
   Defense Score:          0.450
   Detection Confidence:   0.520

🎮 TURN-BY-TURN ACTIONS

   Step 1: attacker | craft-exploit             (intensity: 0.42)
              → Risk: 0.548 | Defense: 0.450 | Detection: 0.510 | Reward: +0.323

   Step 2: ciso     | enable-guardrails         (intensity: 0.49)
              → Risk: 0.548 | Defense: 0.629 | Detection: 0.549 | Reward: +0.633

   Step 3: defender | quarantine-asset          (intensity: 0.56)
              → Risk: 0.486 | Defense: 0.502 | Detection: 0.605 | Reward: +0.556

   Step 4: judge    | score-trajectory          (intensity: 0.63)
              → Risk: 0.486 | Defense: 0.502 | Detection: 0.645 | Reward: +0.556
              ⚠️  Episode TERMINATED at step 4

📈 FINAL STATE
   Risk Score:             0.486
   Defense Score:          0.502
   Detection Confidence:   0.645
   Episode Complete:       Yes

💰 REWARD SUMMARY
   Attacker:     +0.323
   CISO:         +0.633
   Defender:     +0.556
   Judge:        +0.556
   Total:         +2.068
```

### Step 5.2: Compare Multi-Run Performance

```bash
# List all recent runs
ls -1 runs/rl-sim/ | tail -5

# Compare two runs side-by-side
pnpm --filter @aegis-arena/cli dev -- sim compare \
  --run1 2026-05-02T12-34-56-789Z-abc123def \
  --run2 2026-04-30T08-15-22-123Z-xyz789abc

# Output shows:
# - Agent reward distributions (box plots)
# - Per-protocol attack success rates
# - Defense effectiveness metrics
# - Average episode length
```

### Step 5.3: Export Results for Analysis

```bash
# Export trajectory data to CSV for external analysis
pnpm --filter @aegis-arena/cli dev -- sim export \
  --run 2026-05-02T12-34-56-789Z-abc123def \
  --format csv \
  --output results.csv

# Export to standard RL format (for use in other frameworks)
pnpm --filter @aegis-arena/cli dev -- sim export \
  --run 2026-05-02T12-34-56-789Z-abc123def \
  --format trajdata \
  --output results.tar.gz
```

---

## Complete E2E Test Scenario

Here's the full workflow as a single bash script:

```bash
#!/bin/bash
set -e

echo "🚀 Aegis Arena E2E Test: Profile + Simulation"
echo "=============================================="

# Phase 1: Create Profile
echo -e "\n📝 Phase 1: Creating user profile..."
pnpm --filter @aegis-arena/cli dev -- login safe \
  --safe 0x1234567890123456789012345678901234567890 \
  --mode browser

# Phase 2: Seed ETL Data
echo -e "\n📥 Phase 2: Seeding ETL datasets..."
pnpm --filter @aegis-arena/cli dev -- etl fetch --dataset-type incidents
pnpm --filter @aegis-arena/cli dev -- etl fetch --dataset-type protocols
pnpm --filter @aegis-arena/cli dev -- etl fetch --dataset-type epochs
pnpm --filter @aegis-arena/cli dev -- etl fetch --dataset-type agents

# Phase 3: Initialize Simulation
echo -e "\n⚙️  Phase 3: Initializing simulation..."
RUN_ID=$(pnpm --filter @aegis-arena/cli dev -- sim init \
  --run-name "E2E Test" \
  --protocols drift-protocol,uniswap \
  --episodes-per-protocol 1 | grep "runId" | cut -d: -f2 | tr -d ' ')
echo "Run ID: $RUN_ID"

# Phase 4: Execute Simulation
echo -e "\n▶️  Phase 4: Running simulation..."
pnpm --filter @aegis-arena/cli dev -- sim run --run "$RUN_ID" --verbose

# Phase 5: Analyze Results
echo -e "\n📊 Phase 5: Analyzing results..."
pnpm --filter @aegis-arena/cli dev -- sim replay --run "$RUN_ID"

echo -e "\n✅ E2E Test Complete!"
```

---

## Troubleshooting

### Common Issues

**Issue: "Cannot connect to Galileo RPC"**
```bash
# Verify RPC endpoint is reachable
curl -X POST https://evmrpc-testnet.0g.ai \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

**Issue: "Profile login failed - invalid Safe address"**
- Verify Safe address format (should be `0x...` with 40 hex chars)
- Confirm the Safe exists on Galileo testnet via explorer
- Try with your EOA first to test the signing flow

**Issue: "ETL fetch timeout - 0G Storage unreachable"**
```bash
# Fallback to local seed data
cp data/etl-seeds/*.jsonl runs/web-data/etl/datasets/
```

**Issue: "Simulation crashes at step 2"**
- Check agent policy files are compiled: `ls packages/rl-policy/dist/policies/`
- Verify protocol metadata is loaded: `cat runs/web-data/etl/datasets/protocols.jsonl | head`

---

## Next Steps

After completing the E2E test:

1. **Train custom policies**: Use `sim train` to fine-tune agents on your scenario
2. **Compare variants**: Test different policy versions with `sim compare`
3. **Export for external evaluation**: Convert trajectories to standard formats with `sim export`
4. **Integrate with web dashboard**: Sync results to the Vercel control plane for visualization

---

## References

- **Simulation Architecture**: [docs/simulation_feature.md](simulation_feature.md)
- **CLI Command Reference**: [docs/cli-actions-and-logs.md](cli-actions-and-logs.md)
- **0G Testnet Setup**: [docs/0g-testnet-safe-attestation-runbook.md](0g-testnet-safe-attestation-runbook.md)
- **Web Control Plane**: [docs/vercel-control-plane.md](vercel-control-plane.md)
- **Autoresearch Loop**: [docs/autoresearch-loop.md](autoresearch-loop.md)
