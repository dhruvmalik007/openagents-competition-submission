# `Simulation` specification:

## Overview
this documentation explains the  `sim replay` command that pretty-prints recorded episode trajectories in human-readable format with color-coded output, rewards visualization, and turn-by-turn analytics.

## Features

### Command Signature
```bash
pnpm --filter @aegis-arena/cli exec tsx src/index.ts sim replay --run <runId> [--protocol <slug>]
```

### Usage Examples

**Show all episodes from a run:**
```bash
sim replay --run 2026-05-01T18-40-02-169Z-0d0585dd
```

**Show a specific protocol's episode:**
```bash
sim replay --run 2026-05-01T18-40-02-169Z-0d0585dd --protocol zerolend
```

## Output Format

The replay command displays each episode with:

### 1. **Episode Header**
- Box-formatted episode identifier (protocol-slug and episode number)
- Cyan colored for visual separation

### 2. **Initial State (Reset)**
- Starting Risk Score
- Starting Defense Score  
- Starting Detection Confidence

### 3. **Turn-by-Turn Actions** (🎮 TURN-BY-TURN ACTIONS)
For each step in the episode:
- **Agent & Action**: Color-coded agent role with action type
  - 🔴 Attacker (red)
  - 🟡 CISO (yellow)
  - 🟢 Defender (green)
  - 🔵 Judge (blue)
- **Action Intensity**: Magnitude of the action (0.0–1.0)
- **State Transition**: Updated Risk, Defense, and Detection scores
- **Reward Signal**: Color-coded based on magnitude
  - 🟢 High reward (≥ 0.6)
  - 🟡 Medium reward (0.4–0.6)
  - 🔴 Low reward (< 0.4)
- **Terminal Status**: Shows if episode TERMINATED or TRUNCATED

Example:
```
Step 1: attacker | craft-exploit             (intensity: 0.42)
        → Risk: 0.668 | Defense: 0.600 | Detection: 0.510 | Reward: +0.368

Step 2: ciso     | enable-guardrails         (intensity: 0.49)
        → Risk: 0.668 | Defense: 0.629 | Detection: 0.549 | Reward: +0.633
```

### 4. **Final State**
- Final Risk, Defense, Detection scores
- Episode completion status

### 5. **Reward Summary** (💰 REWARD SUMMARY)
Per-agent accumulated rewards:
- **Attacker**: Total reward for attack actions
- **CISO**: Total reward for alert/escalation actions
- **Defender**: Total reward for defensive actions
- **Judge**: Total reward for scoring actions
- **Total**: Sum of all agent rewards

Example:
```
💰 REWARD SUMMARY
   Attacker:     +0.368
   CISO:         +0.633
   Defender:     +0.682
   Judge:        +0.670
   Total:         +2.353
```

## Implementation Details

### New Functions Added

**`colorize(text: string, color: ColorName): string`**
- Adds ANSI color codes to terminal output
- Supported colors: red, green, yellow, blue, cyan, gray

**`formatReward(reward: number): string`**
- Formats reward values with color coding
- High rewards (≥ 0.6): green
- Medium rewards (0.4–0.6): yellow
- Low rewards (< 0.4): red

**`handleSimReplay(options: ReplayOptions): Promise<void>`**
- Main handler for the replay command
- Loads manifest and openenv-step-results.jsonl
- Parses and groups logs by episode
- Formats and displays each episode

**`getAgentColor(agent: AgentRole): ColorName`**
- Maps agent roles to terminal colors
- Attacker → red, CISO → yellow, Defender → green, Judge → blue

### Type Definitions

**`ReplayOptions`**
```typescript
type ReplayOptions = {
  run: string;           // Run ID (required)
  protocol?: string;     // Optional protocol slug filter
};
```

## Integration with CLI

The command is registered in `registerSimCommands()`:
```typescript
sim
  .command('replay')
  .description('Pretty-print a recorded episode trajectory in human-readable format')
  .option('--run <runId>', 'run ID to replay', '')
  .option('--protocol <slug>', 'optional protocol slug to filter trajectory')
  .action(async (options: ReplayOptions) => {
    if (!options.run) {
      console.error('Error: --run <runId> is required');
      process.exit(1);
    }
    await handleSimReplay(options);
  });
```

## Data Sources

The replay command reads from run artifacts:
- **manifest.json**: Run metadata for validation
- **openenv-step-results.jsonl**: JSONL file with one event per line
  - `openenv.reset`: Initial observation
  - `openenv.step`: Agent action and resulting state
  - `openenv.state`: Final episode state

Each run is stored at: `runs/rl-sim/[runId]/openenv-step-results.jsonl`

## Verification & Testing

### Build Status
✅ TypeScript compilation successful (no errors)

### Test Runs

**Test 1: Single Protocol Replay**
```
Run: 2026-05-01T18-39-27-141Z-a1b91dc4
Protocol: drift-protocol
Episodes: 1
Steps per episode: 6 (terminated at step 4)
Total reward: 2.353
```

**Test 2: Multi-Protocol Replay**
```
Run: 2026-05-01T18-40-02-169Z-0d0585dd
Protocols: All 18 (drift, foomcash, hyperbridge, etc.)
Episodes per protocol: 1
Steps per episode: 5
Result: Successfully displayed all 18 episodes with color-coded output
```

**Test 3: Help Command**
```
$ sim --help
Commands:
  run [options]     Run a deterministic multi-agent RL simulation...
  replay [options]  Pretty-print a recorded episode trajectory in human-readable format
  help [command]    display help for command
```

## Visual Output Example

```
╔══════════════════════════════════════════════════════════╗
║  Episode: zerolend-0018                                  ║
╚══════════════════════════════════════════════════════════╝

📊 INITIAL STATE (Reset)
   Risk Score:             0.510
   Defense Score:          0.450
   Detection Confidence:   0.520

🎮 TURN-BY-TURN ACTIONS

   Step 1: attacker | craft-exploit             (intensity: 0.42)
              → Risk: 0.548 | Defense: 0.450 | Detection: 0.510 | Reward: +0.323

   Step 2: ciso     | enable-guardrails         (intensity: 0.49)
              → Risk: 0.548 | Defense: 0.479 | Detection: 0.549 | Reward: +0.507

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
   CISO:         +0.507
   Defender:     +0.556
   Judge:        +0.556
   Total:         +1.942

✅ Replay complete
```

## Next Steps

Pending features for future implementation:
1. **`sim train`**: Karpathy-style autoresearch loop with policy variants
2. **`sim export`**: Convert trajectories to standard RL formats (e.g., MuJoCo, TrajData)
3. **`sim compare`**: Compare multiple runs' metrics and trajectories
4. **`sim analyze`**: Generate statistical reports on agent performance

## Files Modified

- `apps/cli/src/commands/sim.ts`: Added replay command handler and formatting functions
- Exports: `handleSimReplay()`, `colorize()`, `formatReward()`, `getAgentColor()`
- No other files modified; fully backward compatible with existing `sim run` command
