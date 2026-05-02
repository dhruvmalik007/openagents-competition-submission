/**
 * Ledger Hardware Wallet Service
 *
 * Provides integration with Ledger hardware wallets for Node 24 on darwin/arm64
 * where node-hid prebuilt binaries are unavailable.
 *
 * Architecture mirrors safe-global/safe-cli-nodejs's LedgerService:
 *   - isDeviceConnected()  → TransportNodeHid.list()  (non-intrusive HID enumeration)
 *   - waitForDevice()      → polls list() until a device appears
 *   - loginWithLedger()    → TransportNodeHid.create() + signPersonalMessage
 *
 * Because the workspace runs Node 24 (ABI v137) and node-hid ships no prebuilt
 * for that ABI on darwin/arm64, all Ledger calls are dispatched to an isolated
 * CJS runtime under ~/.aegis-arena/ledger-runtime/ that installs its own copy of
 * node-hid under Node's own module resolver (clearing NODE_PATH to prevent the
 * pnpm workspace leaking its broken binding).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getAddress } from 'viem';
import { getAegisHome } from './session-store.js';

// ---------------------------------------------------------------------------
// Isolated runtime: package manifest
// ---------------------------------------------------------------------------

export const LEDGER_RUNTIME_PACKAGE_JSON = {
  name: 'aegis-ledger-runtime',
  private: true,
  type: 'commonjs',
  dependencies: {
    '@ledgerhq/hw-app-eth': '^6.44.4',
    '@ledgerhq/hw-transport-node-hid': '^6.29.6',
    'node-hid': '^2.1.2'
  }
} as const;

// ---------------------------------------------------------------------------
// Isolated runtime: CJS worker script
//
// Supports two actions:
//   node ledger-runtime.cjs detect
//       → stdout: {"connected":true,"count":1}
//
//   node ledger-runtime.cjs login <derivationPath> <challengeBase64>
//       → stdout: {"signerAddress":"0x…","signature":"0x…"}
//
// All errors are written to stderr and the process exits with code 1.
// ---------------------------------------------------------------------------

export const LEDGER_RUNTIME_SCRIPT = `'use strict';

(async () => {
  const action = process.argv[2];

  // ── detect ──────────────────────────────────────────────────────────────
  if (action === 'detect') {
    const transportModule = require('@ledgerhq/hw-transport-node-hid');
    const TransportNodeHid = transportModule.default || transportModule;
    const devices = await TransportNodeHid.list();
    process.stdout.write(JSON.stringify({ connected: devices.length > 0, count: devices.length }));
    return;
  }

  // ── login ────────────────────────────────────────────────────────────────
  if (action === 'login') {
    const derivationPath = process.argv[3];
    const challengeBase64 = process.argv[4];

    if (!derivationPath || !challengeBase64) {
      throw new Error('Usage: node ledger-runtime.cjs login <derivationPath> <challengeBase64>');
    }

    const challenge = Buffer.from(challengeBase64, 'base64').toString('utf8');
    const transportModule = require('@ledgerhq/hw-transport-node-hid');
    const ethModule = require('@ledgerhq/hw-app-eth');

    const TransportNodeHid = transportModule.default || transportModule;
    const Eth = ethModule.default || ethModule;
    const transport = await TransportNodeHid.create();

    try {
      const eth = new Eth(transport);
      const addressResult = await eth.getAddress(derivationPath, false, true);
      const signatureResult = await eth.signPersonalMessage(
        derivationPath,
        Buffer.from(challenge, 'utf8').toString('hex')
      );

      let v = Number(signatureResult.v);
      if (Number.isNaN(v)) {
        throw new Error('Ledger returned a non-numeric v component in signature payload.');
      }
      // Ledger returns v as 0/1; Ethereum expects 27/28
      if (v < 27) v += 27;

      const signature = '0x' + signatureResult.r + signatureResult.s + v.toString(16).padStart(2, '0');
      process.stdout.write(JSON.stringify({ signerAddress: addressResult.address, signature }));
    } finally {
      if (typeof transport.close === 'function') {
        await transport.close();
      }
    }
    return;
  }

  throw new Error('Unknown action: ' + action + '. Expected "detect" or "login".');
})().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message + '\\n');
  process.exit(1);
});
`;

// ---------------------------------------------------------------------------
// Runtime directory helpers
// ---------------------------------------------------------------------------

export function getLedgerRuntimeDir(): string {
  const runtimeDir = join(getAegisHome(), 'ledger-runtime');
  mkdirSync(runtimeDir, { recursive: true });
  return runtimeDir;
}

export function ensureLedgerRuntimeFiles(runtimeDir: string): { scriptPath: string } {
  const packageJsonPath = join(runtimeDir, 'package.json');
  const scriptPath = join(runtimeDir, 'ledger-runtime.cjs');
  const expectedPackageJson = `${JSON.stringify(LEDGER_RUNTIME_PACKAGE_JSON, null, 2)}\n`;

  if (!existsSync(packageJsonPath) || readFileSync(packageJsonPath, 'utf8') !== expectedPackageJson) {
    writeFileSync(packageJsonPath, expectedPackageJson, 'utf8');
  }

  if (!existsSync(scriptPath) || readFileSync(scriptPath, 'utf8') !== LEDGER_RUNTIME_SCRIPT) {
    writeFileSync(scriptPath, LEDGER_RUNTIME_SCRIPT, 'utf8');
  }

  return { scriptPath };
}

export function ensureLedgerRuntimeDependencies(runtimeDir: string): void {
  const isolatedEnv = { ...process.env, NODE_PATH: '' };

  // Quick smoke-test: can the runtime already resolve all three packages?
  const testRequire = spawnSync(
    process.execPath,
    ['-e', "require('node-hid'); require('@ledgerhq/hw-transport-node-hid'); require('@ledgerhq/hw-app-eth');"],
    { cwd: runtimeDir, encoding: 'utf8', env: isolatedEnv }
  );

  if (testRequire.status === 0) return;

  const npmVersion = spawnSync('npm', ['--version'], { encoding: 'utf8', env: isolatedEnv });
  if (npmVersion.status !== 0) {
    throw new Error('npm is required for Ledger runtime setup but is not available on PATH.');
  }

  console.log('Installing Ledger runtime dependencies (one-time setup)…');
  const installResult = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: runtimeDir,
    encoding: 'utf8',
    env: isolatedEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (installResult.status !== 0) {
    throw new Error(
      `Failed to install Ledger runtime dependencies.\n${installResult.stderr || installResult.stdout || 'Unknown npm error.'}`
    );
  }
}

// ---------------------------------------------------------------------------
// Device detection  (mirrors safe-cli-nodejs LedgerService.isDeviceConnected)
// ---------------------------------------------------------------------------

/** Returns true if at least one Ledger device is visible over USB HID. */
export async function isLedgerConnected(): Promise<boolean> {
  const runtimeDir = getLedgerRuntimeDir();
  const { scriptPath } = ensureLedgerRuntimeFiles(runtimeDir);
  ensureLedgerRuntimeDependencies(runtimeDir);
  const isolatedEnv = { ...process.env, NODE_PATH: '' };

  const result = spawnSync(process.execPath, [scriptPath, 'detect'], {
    cwd: runtimeDir,
    encoding: 'utf8',
    env: isolatedEnv
  });

  if (result.status !== 0) return false;

  try {
    const payload = JSON.parse(result.stdout.trim()) as { connected: boolean; count: number };
    return payload.connected;
  } catch {
    return false;
  }
}

/**
 * Waits until a Ledger device is physically connected over USB.
 * Mirrors safe-cli-nodejs LedgerService.waitForDevice().
 *
 * @param timeoutMs  Maximum wait time in milliseconds (default: 60 s)
 * @param pollMs     Polling interval in milliseconds (default: 1 s)
 */
export async function waitForLedgerDevice(timeoutMs = 60_000, pollMs = 1_000): Promise<void> {
  const startTime = Date.now();
  process.stdout.write('Waiting for Ledger device to be connected');

  while (Date.now() - startTime < timeoutMs) {
    if (await isLedgerConnected()) {
      process.stdout.write(' ✓\n');
      return;
    }

    process.stdout.write('.');
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  process.stdout.write('\n');
  throw new Error(
    `Timeout: no Ledger device detected after ${Math.round(timeoutMs / 1000)} s.\n` +
      'Make sure your Ledger is plugged in, then try again.'
  );
}

// ---------------------------------------------------------------------------
// Signing  (isolated runtime, NODE_PATH cleared to avoid pnpm leak)
// ---------------------------------------------------------------------------

export type LedgerLoginResult = {
  signerAddress: `0x${string}`;
  signature: `0x${string}`;
};

/**
 * Signs a personal-message challenge with the Ledger key at `derivationPath`.
 *
 * Before signing this function:
 *  1. Detects whether a device is connected (guides the user if not).
 *  2. Guides the user to unlock the device and open the Ethereum app.
 *  3. Submits the sign request and returns the result.
 */
export async function ledgerSign(derivationPath: string, challenge: string): Promise<LedgerLoginResult> {
  // ── 1. Ensure device is connected ────────────────────────────────────────
  const connected = await isLedgerConnected();
  if (!connected) {
    console.log('No Ledger device detected. Please:');
    console.log('  1. Plug your Ledger into a USB port.');
    console.log('  2. Unlock it with your PIN.');
    console.log('  3. Open the Ethereum app on the device.');
    await waitForLedgerDevice();
  }

  // ── 2. Attempt sign with guided error messages ────────────────────────────
  const runtimeDir = getLedgerRuntimeDir();
  const { scriptPath } = ensureLedgerRuntimeFiles(runtimeDir);
  const isolatedEnv = { ...process.env, NODE_PATH: '' };

  const challengeBase64 = Buffer.from(challenge, 'utf8').toString('base64');
  const execution = spawnSync(process.execPath, [scriptPath, 'login', derivationPath, challengeBase64], {
    cwd: runtimeDir,
    encoding: 'utf8',
    env: isolatedEnv
  });

  if (execution.status !== 0) {
    const stderr = execution.stderr?.trim() ?? '';
    // Categorise common Ledger error codes for helpful guidance
    if (stderr.includes('0x5515') || stderr.toLowerCase().includes('locked device')) {
      throw new Error(
        'Ledger device is locked.\n' +
          'Unlock your Ledger with your PIN, then open the Ethereum app and try again.'
      );
    }

    if (stderr.includes('0x6700') || stderr.toLowerCase().includes('incorrect length')) {
      throw new Error(
        'Ledger returned "Incorrect length" (0x6700).\n' +
          'Make sure the Ethereum app is open on your Ledger (not the dashboard), then try again.'
      );
    }

    if (
      stderr.includes('0x6d00') ||
      stderr.toLowerCase().includes('ins not supported') ||
      stderr.toLowerCase().includes('app not open')
    ) {
      throw new Error(
        'Ledger app not open or instruction not supported (0x6d00).\n' +
          'Open the Ethereum app on your Ledger and try again.'
      );
    }

    if (stderr.includes('0x6804') || stderr.toLowerCase().includes('dependencies')) {
      throw new Error(
        'Ledger requires "Allow blind signing" or "Contract data" to be enabled.\n' +
          'Go to Ethereum app → Settings → Blind signing → enable it, then try again.'
      );
    }

    throw new Error(`Ledger sign failed.\n${stderr || execution.stdout || 'Unknown runtime error.'}`);
  }

  const payload = JSON.parse(execution.stdout.trim()) as { signerAddress: string; signature: string };

  return {
    signerAddress: getAddress(payload.signerAddress) as `0x${string}`,
    signature: payload.signature as `0x${string}`
  };
}
