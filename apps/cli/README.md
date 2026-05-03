# Aegis Arena CLI

CLI for wallet onboarding, 0G Galileo testing, simulation runs, and web session sync.

## Build

```bash
pnpm --filter @aegis-arena/cli build
```

## Local install options

### Option A: Global link (fast dev loop)

```bash
pnpm --filter @aegis-arena/cli link:global
```

Then run:

```bash
aegis --help
```

### Option B: Local packed tarball

```bash
pnpm --filter @aegis-arena/cli pack:local
pnpm add -g .local-packages/aegis-arena-cli-*.tgz
```

## Wallet onboarding + web sync

```bash
aegis login wallet
aegis login sync-web --base-url http://localhost:3000
```

`aegis login wallet` now prompts the user to choose one of:

- browser wallet login,
- direct Ledger validation in the CLI,
- Privy-backed wallet login.

## Packaged end-to-end workflow

After installing the CLI globally, you can run the full demo flow from the packaged command:

```bash
aegis workflow run \
   --base-url https://aegis-0g-openagents-hackathon.vercel.app \
   --inference og-mock \
   --episodes 1 \
   --steps 8 \
   --slug rhea-finance
```

This performs four steps in order:

1. opens the Safe-owner login flow and stores the local CLI session,
2. syncs that session to the web control plane,
3. triggers the ETL refresh route on the web app,
4. runs the local multi-agent simulation using the 0G-backed inference mode you choose.

If you omit `--auth`, the workflow prompts the user to choose:

- browser wallet,
- Ledger,
- Privy.

To force a specific login mode:

```bash
aegis workflow run --auth ledger --base-url https://aegis-0g-openagents-hackathon.vercel.app
aegis workflow run --auth browser --base-url https://aegis-0g-openagents-hackathon.vercel.app
aegis workflow run --auth privy --address <wallet_address> --privy-access-token <token> --base-url https://aegis-0g-openagents-hackathon.vercel.app
```

To run the training variant instead of a single simulation:

```bash
aegis workflow train \
   --base-url https://aegis-0g-openagents-hackathon.vercel.app \
   --inference og-mock \
   --rounds 2 \
   --variants 3 \
   --episodes 1 \
   --steps 8 \
   --slug rhea-finance
```

If you want to inspect the underlying 0G SDK posture before running the workflow:

```bash
aegis og status
aegis og providers --service inference --detailed
```

For Galileo RPC (default):

```bash
https://evmrpc-testnet.0g.ai
```

## Semantic Versioning & Publishing

This project uses [Changesets](https://github.com/changesets/changesets) to manage semantic versioning across the monorepo.

### Creating a changeset

When you make changes to a package, create a changeset to describe what changed and what type of version bump is needed:

```bash
pnpm changeset
```

You'll be prompted to:
1. Select which packages changed (space to select, enter to confirm)
2. Choose the bump type:
   - **Patch** (0.0.x): Bug fixes, internal improvements
   - **Minor** (0.x.0): New features, new exports
   - **Major** (x.0.0): Breaking changes, removed APIs

3. Write a summary of the changes

This creates a file in `.changeset/` that should be committed with your code.

### Versioning packages

When you're ready to release, apply all pending changesets:

```bash
pnpm changeset:version
```

This:
- Updates `package.json` versions for all changed packages
- Generates/updates `CHANGELOG.md` for each package
- Updates dependency versions automatically (workspace:* protocol handles this)
- Deletes the changeset files (they're now applied)

### Publishing to GitHub Packages

After versioning, publish all changed packages:

```bash
pnpm changeset:publish
```

This will:
1. Build all packages
2. Run linting and tests
3. Publish each package with a new version to GitHub Packages

### Publish authentication

Configure npm to authenticate with GitHub Packages:

```bash
echo "//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}" >> ~/.npmrc
```

Your `GITHUB_TOKEN` needs `write:packages` scope.

## Release Workflow (Complete Process)

```bash
# 1. Make changes to packages
# 2. Create changesets for your changes
pnpm changeset

# 3. (On release day) version all packages
pnpm changeset:version

# 4. Review version bumps and changelog updates
git status

# 5. Publish to GitHub Packages
pnpm changeset:publish

# 6. Push the versioning commits
git push --tags
```

## End-to-End Testing

See [docs/e2e-profile-simulation-test.md](../docs/e2e-profile-simulation-test.md) for complete instructions on testing wallet profile creation and multi-agent simulation execution.
