# Development

## Work Rules

- Match existing conventions. Before adding a file, function, or test, open a nearby peer and mirror its naming, location, and code style, don't create parallel structures.
- Respect existing package boundaries. Don't hardcode consumer-specific behavior into the compiler host.
- Plugin descriptors are JS; transform logic is Go. JS transform functions (e.g. `transformSource`, `transformOutput`) are not part of the public contract.
- `shim.go` files marked `gen_shims:hand-maintained` are not regenerated.
- When code behavior changes, update the matching page under `website/src/content/docs/` in the same change.
- Run `pnpm format` before every commit and stage the result; never commit unformatted output. This keeps the tree consistent with the format gate and avoids a follow-up "format" commit.

## Plugin Configuration

First-party plugin configuration lives in dedicated `*.config.{ts,cts,mts,js,cjs,mjs,json}` files, auto-discovered by upward walk from the entry. Shipped ttsc packages accept only `configFile` (an explicit path) beyond host-owned entry keys.

Inline option keys for `@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip`, and `@ttsc/lint` were withdrawn so package config has one typed, discoverable home, do not reintroduce them.

## Testing

**One test case per file, named after what it asserts.** Applies to both layers.

- **Go unit tests** live in `packages/*/test/`; one `Test*` per file. Run the real command entrypoint (e.g. `go run ./plugin`) so wrapper branches stay covered.
- **TypeScript e2e tests** live in `tests/test-*/src/features/`. Each file exports exactly one `test_<snake_case>` function with a matching file name; `DynamicExecutor` discovers them by prefix. Materialize a temp project, spawn the real binary, and assert on observable output.

Open every case with a doc comment in the same three-part shape: a one-line `Verifies …` headline, a short paragraph stating the non-obvious _why_ (which branch or regression is being pinned), and a 2–4-step numbered list summarizing the scenario.

```ts
/**
 * Verifies plugin corpus: composes rejects cycle between two plugins.
 *
 * Locks the cycle-detection branch in
 * `loadProjectPlugins.ts::composePluginSources`. Composition is one hop only;
 * reciprocal `composes` arrays would silently reswap the binaries of both
 * plugins, so ttsc throws an explicit error instead of routing to the wrong
 * binary.
 *
 * 1. Two plugin descriptors each list the other in `composes`.
 * 2. Run ttsc.
 * 3. Assert non-zero exit and `composes cycle detected` in stderr.
 */
export const test_plugin_corpus_composes_rejects_cycle_between_two_plugins =
  () => {
    /* ... */
  };
```

Use the shared helpers in `tests/utils` and the per-suite `internal/` modules; do not reach into another suite's internals. Regressions that need a real directory layout (not just a synthetic temp file map) go under `tests/projects`.

## Validation

Run the narrowest command that proves the change first, then a broader command when shared behavior or packaging changed. Report any command that could not be run.

Verification shape depends on the change type:

- **Bug fix**: name the failing case and the expected behavior; run a repro that fails before the fix and passes after.
- **Feature**: name the observable behavior; exercise it end-to-end.
- **Refactor**: name what should stay unchanged; rely on the existing test suite or a behavior-locking probe.
- **Review**: name concrete risks, missing tests, or regressions.

## Change Integrity

Treat tests, fixtures, snapshots, CI workflows, package wiring, dependencies, core algorithms, and generated baselines as part of the specification. Changing them requires an explicit user request or a clear product reason, and the final report must call it out.

For mechanical ports, migrations, or broad rewrites, preserve the existing algorithm and public behavior in reviewable slices. Prefer a concrete exemplar over abstract instructions, and inspect the diff before trusting a green test run.
