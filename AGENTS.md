# AGENTS.md

`ttsc` is a standalone TypeScript-Go compiler, runtime, and plugin host.

Keep the package contract general. `ttsc` owns the compiler command, `ttsx`
owns the runtime command, and downstream projects are compatibility fixtures,
not the product definition.

## Layout

- `packages/ttsc`: JS launcher/API, Go native host, driver, shims, and tools.
- `packages/lint`: `@ttsc/lint` package and native lint plugin.
- `packages/banner`, `packages/paths`, `packages/strip`: utility plugins.
- `packages/ttsc-*`: platform packages.
- `tests/smoke`: end-to-end project corpus.
- `tests/projects`: project-shaped fixtures.
- `tests/go-transformer`, `tests/utility-plugins`, `tests/lint`: focused Go and plugin tests.
- `config`, `scripts`: shared config and workspace scripts.

## Commands

Run the relevant subset for the change:

```bash
pnpm install
pnpm format
pnpm build
pnpm test
```

For Go, shim, or native plugin changes:

```bash
pnpm --filter ttsc go:vet
cd packages/ttsc && go list -deps ./cmd/ttsc
node scripts/test-go-transformer.cjs
node scripts/test-go-lint.cjs
node scripts/test-go-utility-plugins.cjs
```

## Work Rules

- Prefer the existing package boundaries and fixture style.
- Add project-shaped regressions under `tests/projects` when behavior depends on real project layout.
- For TypeScript-Go or shim changes, inspect the pinned API and local shims directly.
- Do not hardcode consumer-specific behavior into the compiler host.
