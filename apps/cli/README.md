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
aegis login safe --safe <safe_address> --mode browser
aegis login sync-web --base-url http://localhost:3000
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
