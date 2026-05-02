# Aegis Arena Kurtosis Package

This package holds the reproducible infrastructure definition used to spin up simulation enclaves for Aegis Arena.

## Goals

- model a disposable chain and bridge environment for incident replay,
- co-locate agent coordinator services beside chain infrastructure,
- make scenario infra portable across Docker and Kubernetes-backed Kurtosis engines,
- emit deterministic service names that the CLI can stitch into scenario manifests.

## Contents

- `aegis-arena/main.star` — service graph definition
- `aegis-arena/kurtosis.yml` — package metadata

## Planned Extensions

- optional forked-mainnet service definitions,
- incident-specific contract seeding,
- preloaded attacker and defender agents,
- artifact shippers for run traces and epoch logs.
