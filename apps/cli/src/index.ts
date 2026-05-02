#!/usr/bin/env node

import { Command } from 'commander';
import { cliManifest, formatCommandSummary } from '@aegis-arena/config';
import { buildEpochLogTemplate, buildOgTestPlan, buildResearchProgram } from '@aegis-arena/core';
import { galileoTestnet } from '@aegis-arena/og';
import { loadBundledProtocolInventory } from '@aegis-arena/contracts';
import { registerLoginCommands } from './commands/login-safe.js';
import { registerOgCommands } from './commands/og.js';
import { registerSimCommands } from './commands/sim.js';

declare const process: { argv: string[] };

const program = new Command();

registerLoginCommands(program);
registerOgCommands(program);
registerSimCommands(program);

program
  .name('aegis')
  .description('Aegis Arena CLI for 0G-backed agent simulations and protocol metadata')
  .version('0.1.0');

program
  .command('manifest')
  .description('Print the CLI command manifest and simulation logging model')
  .action(() => {
    console.log(JSON.stringify(cliManifest, null, 2));
  });

program
  .command('commands')
  .description('List the designed command surface in a concise format')
  .action(() => {
    console.log(formatCommandSummary(cliManifest));
  });

program
  .command('epoch-log')
  .description('Print an example epoch log envelope for simulation/training runs')
  .option('--scenario <scenarioId>', 'scenario identifier', 'demo/rhea-finance-2026-04-21')
  .option('--run <runId>', 'run identifier', 'run_demo_001')
  .action((options: { scenario: string; run: string }) => {
    const log = buildEpochLogTemplate({
      scenarioId: options.scenario,
      runId: options.run,
      network: galileoTestnet.networkName
    });

    console.log(JSON.stringify(log, null, 2));
  });

program
  .command('networks')
  .description('Print bundled 0G network metadata used by the adapters')
  .action(() => {
    console.log(JSON.stringify(galileoTestnet, null, 2));
  });

program
  .command('inventory')
  .description('Print a bundled sample protocol contract inventory')
  .option('--slug <slug>', 'protocol slug', 'rhea-finance')
  .action((options: { slug: string }) => {
    console.log(JSON.stringify(loadBundledProtocolInventory(options.slug), null, 2));
  });

program
  .command('research-program')
  .description('Print a sample Karpathy-style autoresearch control loop for a scenario')
  .option('--scenario <scenarioId>', 'scenario identifier', 'demo/rhea-finance-2026-04-21')
  .action((options: { scenario: string }) => {
    console.log(JSON.stringify(buildResearchProgram({ scenarioId: options.scenario }), null, 2));
  });

program
  .command('og-test-plan')
  .description('Print a sample 0G Galileo testnet orchestration and attestation validation plan')
  .option('--scenario <scenarioId>', 'scenario identifier', 'demo/hyperbridge-2026-04-15')
  .option('--safe <safeAddress>', 'safe address used for operator onboarding')
  .action((options: { scenario: string; safe?: string }) => {
    console.log(JSON.stringify(buildOgTestPlan({ scenarioId: options.scenario, safeAddress: options.safe }), null, 2));
  });

program.parseAsync(process.argv);
