# AGENTS.md

This repository is the standalone home for `ttsc` and `ttsx`.

The working rule is strict: treat `ttsc` as a general TypeScript-Go compiler adapter and plugin host, and treat `ttsx` as its runner sibling. Do not frame either package as a consumer-specific build adapter. Downstream projects can be important compatibility fixtures, but the package contracts in this repo must stay general.

## Historical Context

`ttsc` exists because the TypeScript-Go transition removes the old Node.js TypeScript compiler process that tools such as `ttypescript` and `ts-patch` relied on. The old ecosystem could monkey-patch `typescript/lib/tsc.js` or run a patched compiler in-process. TypeScript-Go is a Go binary, so that path is gone.

This is also a maintenance-risk project. TypeScript has a long history of compiler API breakage at patch and minor release boundaries, even before TypeScript-Go. That instability killed or weakened much of the transformer-plugin ecosystem. `ts-patch` and a small number of heavily maintained consumers survived because they were maintained aggressively. TypeScript-Go is newer, its public surface is still moving, and many required APIs are still internal. Every future maintainer must assume that a new TypeScript-Go snapshot can break shims, compiler host behavior, emit behavior, diagnostic formatting, option parsing, or project-reference semantics.

Do not respond to that risk with vague confidence. Keep the test harness sharp. Keep the shim boundary small and reviewable. When TypeScript-Go moves, inspect the upstream API and the local shims directly.

## Repository Shape

- `packages/ttsc`: compiler adapter, JS API, plugin host, Go native CLI, TypeScript-Go shims.
- `packages/ttsx`: runner package that reuses `ttsc`.
- `tests/smoke`: standalone end-to-end tests for generic projects and generic plugins.
- `tests/projects`: real fixture projects copied by the smoke suite. Add project-shaped regressions here instead of hiding every case inside test functions.
- `tests/go-transformer`: Go transformer library and native backend fixture used to prove that plugin-selected native binaries can participate in the transform pipeline.
- `config`: shared TypeScript compiler configuration.

The smoke suite must stay as a corpus, not a single happy-path file. Add new reference-derived cases under:

- `tests/smoke/test/compiler-corpus.test.cjs`
- `tests/smoke/test/plugin-corpus.test.cjs`
- `tests/smoke/test/runner-corpus.test.cjs`
- `tests/smoke/test/transform-projects.test.cjs`
- `tests/smoke/test/_helpers.cjs`

## Required Commands

Run these before claiming the workspace is healthy:

```bash
pnpm install
pnpm run build
pnpm test
```

For TypeScript-Go or shim changes, also run:

```bash
pnpm --filter ttsc go:vet
cd packages/ttsc && go list -deps ./cmd/ttsc
```

## Review Discipline

When changing `ttsc`, check all of these surfaces:

- CLI parity: `ttsc`, `ttsc -p`, `ttsc --noEmit`, `ttsc --watch`, `ttsc transform`.
- JS API parity: `build`, `check`, `transform`, `transformAsync`, `version`.
- project config: `tsconfig.json`, `jsconfig.json`, `extends`, plugin inheritance, circular extends.
- plugin loading: `default`, `plugin`, `createTtscPlugin`, relative paths, package paths.
- native backend selection: `native.mode`, `native.binary`, `contractVersion`.
- TypeScript-Go wrapper: config parse, Program creation, checker acquisition/release, diagnostics, emit.
- shim drift: every `go:linkname` target must still exist in the pinned TypeScript-Go version.
- `ttsx`: no duplicated compiler semantics; it must call `ttsc` APIs.

When changing `ttsx`, verify both paths:

- CommonJS: in-process require hook and single-file transform cache.
- ESM: cached project build, rewritten relative `.js` imports, child Node execution.

## Upstream Drift Policy

When bumping `@typescript/native-preview` or `github.com/microsoft/typescript-go`:

1. Read the upstream compiler, tsconfig, Program, emit, diagnostics, VFS, and checker changes relevant to the shim imports.
2. Regenerate or inspect shims under `packages/ttsc/shim`.
3. Run Go tests before JS smoke tests.
4. Add or tighten a regression test for the breakage that prompted the bump.

Never treat a green `pnpm test` as proof that all TypeScript-Go internals are stable. It proves only the current covered surface. If the change touches shims or compiler internals, inspect the upstream code directly.

## Design Rules

- Keep `ttsc` independent from any single consumer.
- Keep `ttsx` thin and dependent on `ttsc`.
- Prefer structured TypeScript-Go APIs and shim wrappers over string-based compiler behavior.
- Do not add source-specific hardcoding to the compiler host.
- Do not widen the public plugin API casually. `native`, `transformOutput`, and project plugin loading are the current stable surface.
- If a new public hook is required, add tests that lock the compatibility promise.

## Reference Repositories

Local references commonly used for audits:

- `/home/samchon/github/contributions/typescript-go`
- `/home/samchon/github/contributions/tsgolint`
- `/home/samchon/github/contributions/tsgonest`
- `/home/samchon/github/contributions/typical`
- `/home/samchon/github/contributions/ts-patch`
- `/home/samchon/github/contributions/tsx`
- `/home/samchon/github/contributions/ts-node`
- `/home/samchon/github/samchon/typia@next`

Use them when a change touches TypeScript-Go internals, shim generation, Go compiler-host patterns, emitted JS rewrite strategy, or runner behavior. Be ready to read exact files line by line instead of relying on memory.
