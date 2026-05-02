# Autoresearch Loop

Aegis Arena now frames scenario training around a bounded autoresearch loop inspired by Andrej Karpathy’s `autoresearch` project.

## Core Idea

Each scenario keeps a human-authored control file at `research/<scenario>/program.md` and an append-only results ledger at `research/<scenario>/results.tsv`.

The loop is intentionally narrow:

1. Establish a baseline run.
2. Modify only the scenario policy or reward surface.
3. Re-run within a fixed budget.
4. Keep the variant only if the target metric improves.
5. Reset otherwise and append the result to the ledger.

## Why It Fits Aegis Arena

Unlike open-ended agent prompting, the autoresearch loop gives the hackathon demo a concrete optimization story:

- the attacker policy tries to maximize exploit execution quality,
- the defender policy tries to maximize funds recovered and time-to-detection,
- the evaluator agent turns each episode into a single comparable metric,
- the ledger makes improvements auditable instead of anecdotal.

## Default Budget Model

The default budget is `300` seconds per iteration, mirroring the original `autoresearch` emphasis on tight and repeatable experiments.

Recommended tracked metrics:

- `defender_net_recovery_usd`
- `attacker_profit_usd`
- `time_to_detection_seconds`
- `false_positive_rate`
- `incident_replay_fidelity`

## Suggested Repo Layout

```text
research/
  rhea-finance-2026-04-21/
    program.md
    policy.ts
    reward-config.json
    results.tsv
```

## Result Ledger Columns

A practical ledger row for Aegis Arena should record:

- `commit`
- `scenario_id`
- `variant_tag`
- `metric_name`
- `metric_value`
- `budget_seconds`
- `status`
- `description`

## Operational Guardrails

- Keep the editable surface small so evaluation stays interpretable.
- Prefer one primary metric per loop and track secondary metrics separately.
- Store run artifacts under `runs/research/<scenario>/`.
- Treat crashes as first-class results and write them to the ledger.
- Use 0G-backed inference consistently across baseline and variants to reduce evaluation drift.
