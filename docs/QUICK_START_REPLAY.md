# Quick Start: sim replay Command

## One-Minute Overview

The `sim replay` command reads stored simulation runs and displays them in a beautiful, color-coded terminal format showing exactly what each agent did at each step and how much reward they earned.

## Usage

### Run a simulation first
```bash
pnpm --filter @aegis-arena/cli exec tsx src/index.ts sim run \
  --episodes 1 \
  --steps 8 \
  --slug zerolend
```
This outputs a `runId` like: `2026-05-01T18-42-24-178Z-c10c8adc`

### Then replay it
```bash
pnpm --filter @aegis-arena/cli exec tsx src/index.ts sim replay \
  --run 2026-05-01T18-42-24-178Z-c10c8adc
```

## Output Format

Each episode shows:
1. **Initial State** - Starting Risk/Defense/Detection scores
2. **Turn-by-Turn Actions** - Each agent's move with:
   - Who acted (color-coded role)
   - What they did (action type)
   - How hard they tried (intensity)
   - How world changed (new scores)
   - How much they earned (reward, color-coded)
3. **Final State** - Ending Risk/Defense/Detection scores
4. **Reward Summary** - Total earnings by each agent

## Colors Explained

### Agent Roles
- 🔴 **Red** = Attacker (trying to exploit)
- 🟡 **Yellow** = CISO (coordinating response)
- 🟢 **Green** = Defender (implementing fixes)
- 🔵 **Blue** = Judge (scoring outcome)

### Reward Quality
- 🟢 **Green** = High reward (≥ 0.6)
- 🟡 **Yellow** = Medium reward (0.4–0.6)
- 🔴 **Red** = Low reward (< 0.4)

## Common Commands

**See all episodes from latest run**
```bash
sim replay --run 2026-05-01T18-42-24-178Z-c10c8adc
```

**See just one protocol's episode**
```bash
sim replay --run 2026-05-01T18-42-24-178Z-c10c8adc --protocol solv-protocol
```

## Example Output

```
╔══════════════════════════════════════════════════════════╗
║  Episode: drift-protocol-0001                            ║
╚══════════════════════════════════════════════════════════╝

📊 INITIAL STATE (Reset)
   Risk Score:             0.630
   Defense Score:          0.600
   Detection Confidence:   0.520

🎮 TURN-BY-TURN ACTIONS

   Step 1: attacker | craft-exploit             (intensity: 0.42)
              → Risk: 0.668 | Defense: 0.600 | Detection: 0.510 | Reward: +0.368

   Step 2: ciso     | enable-guardrails         (intensity: 0.49)
              → Risk: 0.668 | Defense: 0.629 | Detection: 0.549 | Reward: +0.633

   Step 3: defender | quarantine-asset          (intensity: 0.56)
              → Risk: 0.606 | Defense: 0.652 | Detection: 0.605 | Reward: +0.682

   Step 4: judge    | score-trajectory          (intensity: 0.63)
              → Risk: 0.606 | Defense: 0.652 | Detection: 0.645 | Reward: +0.670
              ⚠️  Episode TERMINATED at step 4

📈 FINAL STATE
   Risk Score:             0.606
   Defense Score:          0.652
   Detection Confidence:   0.645
   Episode Complete:       Yes

💰 REWARD SUMMARY
   Attacker:     +0.368
   CISO:         +0.633
   Defender:     +0.682
   Judge:        +0.670
   Total:         +2.353

✅ Replay complete
```

## What This Shows

**Defender Strategy**: Notice how defender's quarantine action (step 3) cuts risk from 0.668 → 0.606 while raising detection from 0.549 → 0.605. That's a good trade-off earning +0.682 reward.

**Attacker Reward**: The attacker got +0.368 by raising risk from 0.630 → 0.668. But the defender's countermeasures prevented exploitation (detection confidence rose to 0.645).

**Judge Role**: The judge terminates the episode early (step 4 instead of continuing to step 8) because the defense is effective enough.

**Game Outcome**: Total +2.353 reward across all agents indicates a balanced defense—attacker made progress but not catastrophic, defenders responded appropriately.

## Tips

- Use `--steps 8` in `sim run` to see full multi-turn episodes
- Use `--episodes 1` to keep output manageable
- Use `--slug PROTOCOL` to test specific protocols
- Run several times to see different random outcomes
- Compare total rewards across runs to measure policy improvements

## Files Modified

- ✅ `apps/cli/src/commands/sim.ts` - Added replay command (830 lines)
- ✅ No changes to data generation or run artifacts
- ✅ Fully backward compatible with existing `sim run` command
