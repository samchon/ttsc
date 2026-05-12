# AGENTS.md

## What `ttsc` Is

`ttsc` is a standalone TypeScript-Go compiler, runtime, and plugin host. It ships two CLIs and a plugin protocol:

- `ttsc` — build, check, watch, and source-to-source transform on top of `@typescript/native-preview`.
- `ttsx` — run a TypeScript entrypoint after a real type-check (a typed `tsx`/`ts-node`).
- Plugins — Go sidecars that share TypeScript-Go's AST/Checker. `ttsc` builds plugin source on demand and caches the binary.

The contract is general-purpose. Downstream projects like `typia` and `nestia` are compatibility fixtures, not the product definition.

## Layout

- `packages/ttsc`: JS launcher/API, Go host (`cmd`, `driver`, `internal`, `utility`), and `shim/` for TypeScript-Go internals.
- `packages/{banner,paths,strip}`: first-party utility plugins sharing `packages/ttsc/utility/host.go`.
- `packages/lint`: `@ttsc/lint` with its own native engine.
- `packages/unplugin`: bundler adapters.
- `packages/ttsc-*`: per-platform packages (native helper + bundled Go SDK).
- `tests/projects`: project-shaped fixtures.
- `tests/test-*`: feature-test packages.
- `tests/utils`: shared helpers (`@ttsc/testing`).
- `docs`, `config`, `scripts`: guide docs, shared tsconfig, workspace scripts.

## Commands

```bash
pnpm install
pnpm format
pnpm build
pnpm test
```

## Work Rules

- Match existing conventions. Before adding a file, function, or test, open a nearby peer and mirror its naming, location, and code style — don't create parallel structures.
- Respect existing package boundaries. Don't hardcode consumer-specific behavior into the compiler host.
- Plugin descriptors are JS; transform logic is Go. JS transform functions (e.g. `transformSource`, `transformOutput`) are not part of the public contract.
- `shim.go` files marked `gen_shims:hand-maintained` are not regenerated.
- When code behavior changes, update the matching page under `docs/` in the same change.

## Testing

**One test case per file, named after what it asserts.** Applies to both layers.

- **Go unit tests** live in `packages/*/test/`; one `Test*` per file. Run the real command entrypoint (e.g. `go run ./plugin`) so wrapper branches stay covered.
- **TypeScript e2e tests** live in `tests/test-*/src/features/`. Each file exports exactly one `test_<snake_case>` function with a matching file name; `DynamicExecutor` discovers them by prefix. Materialize a temp project, spawn the real binary, and assert on observable output.

Open every case with a doc comment in the same three-part shape: a one-line `Verifies …` headline, a short paragraph stating the non-obvious *why* (which branch or regression is being pinned), and a 2–4-step numbered list summarizing the scenario.

```ts
/**
 * Verifies plugin corpus: composes rejects cycle between two plugins.
 *
 * Locks the cycle-detection branch in `loadProjectPlugins.ts::composePluginSources`.
 * Composition is one hop only; reciprocal `composes` arrays would silently reswap
 * the binaries of both plugins, so ttsc throws an explicit error instead of
 * routing to the wrong binary.
 *
 * 1. Two plugin descriptors each list the other in `composes`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and `composes cycle detected` in stderr.
 */
export const test_plugin_corpus_composes_rejects_cycle_between_two_plugins =
  () => { /* ... */ };
```

Use the shared helpers in `tests/utils` and the per-suite `internal/` modules; do not reach into another suite's internals. Regressions that need a real directory layout (not just a synthetic temp file map) go under `tests/projects`.
