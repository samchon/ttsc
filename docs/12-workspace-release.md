# Workspace Release

This page is for maintainers working on this repository, not for third-party plugin packages. For plugin package publishing, use [Publishing Plugins](./06-publishing.md).

## Local Loop

```bash
pnpm install
pnpm format
pnpm build
pnpm test
```

Use the focused current-platform build while iterating on native or launcher code:

```bash
pnpm run build:current
pnpm run test:features -- --include=ttsc
pnpm --dir packages/ttsc go:vet
```

The root `pnpm test` script builds the current platform package, type-checks the
test workspace, runs the Go transformer/lint/utility-plugin checks, then runs
the `tests/test-*` feature packages. Production package manifests do not own
test scripts; test execution is centralized under `tests`.

## Tarball Smoke

Build local tarballs:

```bash
pnpm run package:tgz
```

Run packed-package install checks:

```bash
pnpm run experimental:install
pnpm run experimental:unplugin
pnpm run experimental
```

`experimental:install` validates the packed `ttsc` package, the current platform package, bundled Go, first-party utility plugins, `ttsc --version`, `ttsc --emit`, and `ttsx`. `experimental:unplugin` validates published-package imports and bundler adapters from a clean consumer project.

## Platform Packages

The `ttsc` package publishes platform helpers as optional dependencies:

- `@ttsc/linux-x64`
- `@ttsc/linux-arm`
- `@ttsc/linux-arm64`
- `@ttsc/darwin-x64`
- `@ttsc/darwin-arm64`
- `@ttsc/win32-x64`
- `@ttsc/win32-arm64`

Each platform package contains the native helper and a bundled Go SDK for source-plugin builds. `scripts/build-platform-package.cjs` uses `TTSC_GO_ROOT_{OS}_{ARCH}` first, then `TTSC_GO_ROOT`, then downloads the configured Go version when it can. `TTSC_GO_VERSION` overrides the bundled Go version.

## Publish

The release workflow runs on pushed tags and executes:

```bash
pnpm run package:latest --no-git-checks --provenance
```

The root `package:latest` script builds platform packages first, publishes all non-`ttsc` packages, then publishes `ttsc` last so its optional dependencies are already available.
