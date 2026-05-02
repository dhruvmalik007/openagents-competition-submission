import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, randomUUID } from 'node:crypto';
import { Address, createPublicClient, getAddress, http, isAddressEqual, recoverMessageAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { openBrowser } from './open-browser.js';
import { type SafeSession } from './session-store.js';
import { ledgerSign } from './ledger-service.js';

type SafeInfo = {
  safeAddress: Address;
  owners: Address[];
  threshold: number;
};

type BrowserLoginResult = {
  signerAddress: Address;
  signature: `0x${string}`;
};


const SAFE_ABI = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }]
  },
  {
    type: 'function',
    name: 'getThreshold',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

export function createChallenge(safeAddress: string, rpcUrl: string, mode: 'browser' | 'private-key' | 'ledger'): string {
  const nonce = randomBytes(16).toString('hex');
  return [
    'Aegis Arena Safe Login',
    `safe=${getAddress(safeAddress)}`,
    `rpc=${rpcUrl}`,
    `mode=${mode}`,
    `nonce=${nonce}`,
    `issued_at=${new Date().toISOString()}`
  ].join('\n');
}

export async function loadSafeInfo(safeAddress: string, rpcUrl: string): Promise<SafeInfo> {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const checksummedSafe = getAddress(safeAddress);
  const [owners, threshold] = await Promise.all([
    client.readContract({ address: checksummedSafe, abi: SAFE_ABI, functionName: 'getOwners' }),
    client.readContract({ address: checksummedSafe, abi: SAFE_ABI, functionName: 'getThreshold' })
  ]);

  return {
    safeAddress: checksummedSafe,
    owners: owners.map((owner) => getAddress(owner)),
    threshold: Number(threshold)
  };
}

export function isSafeOwner(candidate: string, safeInfo: SafeInfo): boolean {
  const checksummedCandidate = getAddress(candidate);
  return safeInfo.owners.some((owner) => isAddressEqual(owner, checksummedCandidate));
}

export async function loginWithPrivateKey(privateKey: `0x${string}`, challenge: string): Promise<BrowserLoginResult> {
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signMessage({ message: challenge });

  return {
    signerAddress: getAddress(account.address),
    signature
  };
}

/**
 * Sign a Safe login challenge with the Ledger hardware wallet.
 *
 * Delegates to ledger-service which:
 *  1. Detects whether a Ledger is connected (guides the user if not).
 *  2. Dispatches to an isolated CJS runtime to avoid the node-hid ABI
 *     mismatch on Node 24 / darwin / arm64.
 *  3. Returns categorised, actionable error messages for all common
 *     Ledger error codes (locked, wrong app, blind-signing off, …).
 */
export async function loginWithLedger(derivationPath: string, challenge: string): Promise<BrowserLoginResult> {
  const result = await ledgerSign(derivationPath, challenge);
  return {
    signerAddress: getAddress(result.signerAddress),
    signature: result.signature
  };
}

function buildBrowserHtml(challenge: string, safeAddress: string): string {
  const safeLiteral = JSON.stringify(safeAddress);
  const challengeLiteral = JSON.stringify(challenge);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Aegis Arena Safe Login</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 860px; margin: 48px auto; line-height: 1.5; }
      button { background: #111827; color: white; border: 0; border-radius: 8px; padding: 12px 18px; font-size: 14px; cursor: pointer; }
      pre { background: #f3f4f6; padding: 16px; border-radius: 8px; overflow-x: auto; }
      .status { margin-top: 16px; color: #374151; }
    </style>
  </head>
  <body>
    <h1>Aegis Arena Safe Login</h1>
    <p>This page signs an Aegis Arena challenge with a wallet account that must already be an owner of the Safe below.</p>
    <p><strong>Safe:</strong> <code>
${safeLiteral}
</code></p>
    <pre id="challenge"></pre>
    <button id="sign-button">Connect Wallet & Sign Challenge</button>
    <p class="status" id="status">Waiting for wallet connection.</p>
    <script>
      const safeAddress = ${safeLiteral};
      const challenge = ${challengeLiteral};
      document.getElementById('challenge').textContent = challenge;

      async function signChallenge() {
        const status = document.getElementById('status');
        if (!window.ethereum) {
          status.textContent = 'No injected wallet found. Open this page in a browser with MetaMask or another EIP-1193 wallet.';
          return;
        }

        status.textContent = 'Requesting wallet access…';
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        const signerAddress = accounts[0];
        status.textContent = 'Signing challenge…';
        const signature = await window.ethereum.request({
          method: 'personal_sign',
          params: [challenge, signerAddress]
        });

        status.textContent = 'Sending signature back to CLI…';
        await fetch('/callback', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ signerAddress, signature, safeAddress })
        });
        status.textContent = 'Done. You can close this tab.';
      }

      document.getElementById('sign-button').addEventListener('click', () => {
        signChallenge().catch((error) => {
          document.getElementById('status').textContent = error instanceof Error ? error.message : String(error);
        });
      });
    </script>
  </body>
</html>`;
}

async function waitForBrowserSignature(
  safeAddress: string,
  challenge: string,
  autoOpen: boolean,
  timeoutMs: number
): Promise<BrowserLoginResult> {
  const checksummedSafe = getAddress(safeAddress);

  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.method === 'GET' && req.url === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(buildBrowserHtml(challenge, checksummedSafe));
        return;
      }

      if (req.method === 'POST' && req.url === '/callback') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const payload = JSON.parse(body) as { signerAddress: string; signature: `0x${string}`; safeAddress: string };
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
            res.end('<html><body><p>Signature received. You can return to the terminal.</p></body></html>');
            server.close();
            clearTimeout(timer);
            resolve({ signerAddress: getAddress(payload.signerAddress), signature: payload.signature });
          } catch (error) {
            res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
            res.end(error instanceof Error ? error.message : String(error));
          }
        });
        return;
      }

      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    });

    server.listen(0, '127.0.0.1', async () => {
      const addressInfo = server.address();
      if (!addressInfo || typeof addressInfo === 'string') {
        reject(new Error('Failed to determine local browser callback address.'));
        return;
      }

      const url = `http://127.0.0.1:${addressInfo.port}/`;
      console.log(`Open your wallet browser at: ${url}`);

      if (autoOpen) {
        try {
          await openBrowser(url);
        } catch {
          console.log('Automatic browser launch failed; open the URL manually.');
        }
      }
    });

    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`Timed out waiting for wallet signature after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
  });
}

export async function loginWithBrowser(safeAddress: string, challenge: string, autoOpen = true, timeoutMs = 120_000): Promise<BrowserLoginResult> {
  return waitForBrowserSignature(safeAddress, challenge, autoOpen, timeoutMs);
}

export async function verifySignedChallenge(challenge: string, signature: `0x${string}`): Promise<Address> {
  return getAddress(await recoverMessageAddress({ message: challenge, signature }));
}

export async function buildVerifiedSession(input: {
  safeAddress: string;
  rpcUrl: string;
  mode: 'browser' | 'private-key' | 'ledger';
  challenge: string;
  signature: `0x${string}`;
  signerAddress: string;
}): Promise<SafeSession> {
  const safeInfo = await loadSafeInfo(input.safeAddress, input.rpcUrl);
  const recoveredAddress = await verifySignedChallenge(input.challenge, input.signature);
  const claimedAddress = getAddress(input.signerAddress);

  if (!isAddressEqual(recoveredAddress, claimedAddress)) {
    throw new Error(`Recovered signer ${recoveredAddress} does not match claimed signer ${claimedAddress}.`);
  }

  if (!isSafeOwner(claimedAddress, safeInfo)) {
    throw new Error(`Signer ${claimedAddress} is not one of the Safe owners for ${safeInfo.safeAddress}.`);
  }

  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + 12 * 60 * 60 * 1000);

  return {
    sessionId: randomUUID(),
    safeAddress: safeInfo.safeAddress,
    signerAddress: claimedAddress,
    rpcUrl: input.rpcUrl,
    mode: input.mode,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    challenge: input.challenge,
    signature: input.signature,
    verifiedOwner: true
  };
}