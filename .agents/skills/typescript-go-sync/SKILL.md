---
name: typescript-go-sync
description: Defines how packages/ttsc/shim stays synchronized with typescript-go and complete for plugin authors. Use before adding a shim re-export, bumping the pinned typescript-go version, or investigating a missing AST, transform, printer, checker, or emit API.
---

# TypeScript-Go Shim Sync

## Why the shim exists

`ttsc` is built on typescript-go, the Go port of `tsc` at module `github.com/microsoft/typescript-go`. Most compiler APIs live under that module's `internal/*` tree, which another Go module cannot import directly.

`packages/ttsc/shim/<name>` is the legal bridge. Each shim directory (`ast`, `checker`, `compiler`, `core`, `printer`, `scanner`, `parser`, `tsoptions`, `tspath`, `vfs`, and others) is its own Go module wrapping the matching `internal/<name>` package.

The shim is the only typescript-go surface available to source-plugin authors such as typia, nestia, and third-party rules. Keep it synchronized with upstream and expose every AST, transform, printer, checker, and emit API a plugin needs. A missing re-export is a ttsc bug, not a plugin bug.

## Shim structure

Each `shim/<name>/` directory has generated and hand-maintained files:

- **Generated `shim.go`, do not edit.** `go run ./tools/gen_shims` writes the exported aliases and linkname declarations for shim packages whose `shim.go` does not opt out of generation.
- **Hand-maintained files.** A `shim.go` that starts with `// gen_shims:hand-maintained` is not regenerated. Keep wrappers and `//go:linkname` declarations there or in another hand-maintained file such as `ast/parent.go`.
- **Package-specific generated support files.** Some packages also have files such as `surface.go` or `enums_gen.go`. Follow their generated-file header and regenerate them with their owning command; do not create one merely to expose a symbol.

Per-directory `extra-shim.json` feeds the generator the symbols it cannot derive on its own: `ExtraFunctions` (unexported funcs to linkname), `ExtraMethods`, `ExtraFields`, and `IgnoreFunctions` (exported funcs the generator should skip because a hand-written variant exists).

Pick the mechanism by what the symbol is:

- **Exported type**: re-run the generator when it can derive the alias. Otherwise add the alias to a hand-maintained file; do not create a generic `surface.go`.
- **Exported func that the generator skips**: add a thin wrapper in a hand-maintained file.
- **Unexported symbol**: add a `//go:linkname` declaration to a hand-maintained file, import `_ "unsafe"`, and declare the function with no body.

## Adding a missing API a plugin needs

The common task: a plugin needs a typescript-go symbol that the shim does not yet re-export.

1. Find the symbol in the pinned typescript-go source under the module cache: `go env GOMODCACHE`/`github.com/microsoft/typescript-go@<version>/internal/<pkg>/`. Confirm its exact name, signature, and whether it is exported.
2. Add the re-export to the matching `shim/<pkg>/`:
   - use `go run ./tools/gen_shims` for symbols the generator derives;
   - use a hand-maintained file for an exported symbol the generator cannot derive; or
   - add a `//go:linkname` declaration for an unexported symbol.
3. Build the shim module and `packages/ttsc` to verify it links.

## Bumping the pinned typescript-go version

The version is pinned per shim module: `require github.com/microsoft/typescript-go v0.0.0-<timestamp>-<hash>` in every `shim/*/go.mod`, kept identical across all of them and also referenced as an indirect require in `packages/ttsc/go.mod`. The sibling `go.work` wires the shim sub-modules; tagged upstream versions can later replace these local wires.

To bump:

1. Update the `require` line to the new pseudo-version in every `shim/*/go.mod` (keep them all the same) and in `packages/ttsc/go.mod`, then refresh each `go.sum`.
2. Re-run `go run ./tools/gen_shims` from `packages/ttsc` to regenerate every generated `shim.go` against the new source.
3. Re-check the hand-maintained `shim.go` files and `extra-shim.json` entries: an upstream rename, signature change, or export/unexport flip can break a wrapper or linkname. Build `packages/ttsc` and fix the fallout.

## Validating a shim change in a real consumer

A shim change is only proven by a downstream plugin compiling and passing against it. Build the ttsc tarballs and install them into a consumer checkout:

```bash
pnpm package:tgz            # full release-rehearsal tarballs
# or, faster for a single platform:
pnpm package:tgz -- --current
```

Install the produced tarballs into `../typia` (or another consumer) and run a relevant typia test that exercises the new API. The `experimental/tarballs/index.ts` flow is what CI uses; `--current` / `TTSC_TARBALLS_CURRENT=1` packs only the current-platform package for a quick loop.

## Mechanical completeness gate

`packages/ttsc/tools/shim_audit` enforces shim completeness in CI (the `shim-audit` job runs `pnpm --filter ttsc shim:audit`) so the recurring "missing re-export" class cannot return. It treats the shim as a closure: if a type is aliased, everything reachable from it should be reachable through the shim. Four layers:

- **Enum families (zero-tolerance).** `shim/<pkg>/enums_gen.go` completes every exposed enum family, re-exporting any member not already exposed by the package. The gate fails on any partial enum. After a typescript-go bump, run `pnpm --filter ttsc shim:audit -fix` to regenerate it.
- **Reachable funcs / escaping types (ratcheted).** `tools/shim_audit/baseline.json` grandfathers the current backlog; the gate fails on any _new_ gap. Expose the symbol, or run `pnpm --filter ttsc shim:audit -write-baseline` to accept it deliberately.
- **Producer closure (zero-tolerance).** Every pointer-like compiler object consumed by a public shim operation must come from a reachable public operation, a callback supplied by the compiler, or a reasoned root or ownership boundary in `baseline.json`'s `producer_exemptions`. The audit follows direct and named callback/container contracts across package functions, hand-written methods, and method sets published by exposed aliases. Operation results unlock only after their compiler-object inputs and receiver are obtainable, so rootless function or method cycles do not satisfy the gate. `-write-baseline` never infers or accepts producer exemptions. Add an exported producer when the object represents plugin-usable compiler state. Exempt only caller-owned configuration, nullable optional inputs, or host/compiler-owned state outside the supported plugin entry points, and give every exemption a non-empty rationale. Automatic exposure alone is not an exemption.
- **Unexported helpers.** Closure cannot predict these. The audit lists them as a demand pool; expose a needed helper with the `//go:linkname` pattern above.

## Traversal-completeness probes

Closure and the audit prove that a symbol is _nameable_ and a composition _compiles_. They cannot prove that an exposed graph-walk operation reaches every required node at runtime.

For every new graph-walk operation, add a runtime probe over a ttsc-owned fixture. Use the exposed traversal and assert that it reaches the expected endpoint; compilation alone proves linkage, not traversal completeness.

Keep traversal probes in `packages/lint/test/shim/`. Build a real Checker through the lint host's `loadProgram`, then exercise generic references and every supported signature shape through the public shim.

Run these probes through `pnpm test:go`. Add a fixture and endpoint assertion whenever a new graph-walk operation could introduce a silent dead end.
