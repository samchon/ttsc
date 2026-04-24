# ttsc

Standalone TypeScript-Go toolchain workspace.

This repository contains two pnpm workspace packages:

- `packages/ttsc`: compiler adapter and plugin host on top of `typescript-go`.
- `packages/ttsx`: `ts-node` / `tsx` style runner that reuses the `ttsc` host.

`ttsc` is not a consumer-specific adapter. It owns the generic compiler lane:

- `ttsc`, `ttsc -p tsconfig.json`, `ttsc --noEmit`, `ttsc --watch`
- `ttsc transform --file=src/index.ts`
- JS APIs: `build`, `check`, `transform`, `transformAsync`, `version`
- tsconfig `compilerOptions.plugins[]` loading
- plugin-declared native backend selection
- emitted JavaScript post-processing hooks

`ttsx` owns only the runner lane:

- `ttsx src/index.ts`
- CommonJS require-hook execution
- ESM cached-build execution
- project-aware cache reuse

## Workspace

```bash
pnpm install
pnpm run build
pnpm test
```

Build order matters:

```bash
pnpm --filter ttsc build
pnpm --filter ttsc go:build
pnpm --filter ttsx build
```

The current compiler dependency is `@typescript/native-preview`. It stands in for the TypeScript-Go lane until the stable `typescript@7` package contract is ready.

## Packages

### `ttsc`

```bash
pnpm --filter ttsc build
pnpm --filter ttsc go:build
pnpm --filter ttsc test
```

The package contains:

- `src/`: public JS API, CLI parser, plugin loader, project helper, binary resolver
- `cmd/ttsc`: Go CLI entrypoint
- `driver/`: TypeScript-Go Program/CompilerHost/emit facade
- `shim/`: go:linkname shims over selected TypeScript-Go internals
- `tools/gen_shims`: shim regeneration tool adapted from the tsgolint pattern

### `ttsx`

```bash
pnpm --filter ttsx build
```

`ttsx` imports `ttsc` directly and must not duplicate project resolution, plugin loading, or native binary selection.

## Tests

The default test suite is standalone and does not rely on a specific downstream consumer:

```bash
pnpm test
```

It covers:

- TypeScript project build through TypeScript-Go
- semantic diagnostic blocking before emit
- generic `transformOutput` plugin composition
- `ttsx` CommonJS entry execution
- platform binary resolution
- Go unit tests around the native CLI and driver surface

Consumer-specific compatibility tests belong in separate fixture packages. They should not become the only proof that `ttsc` works.
