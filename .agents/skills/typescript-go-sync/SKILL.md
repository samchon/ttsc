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

Each `shim/<name>/` directory holds two kinds of file:

- **`surface.go` — generated, do not edit.** Header `// Code generated ... DO NOT EDIT.`. Plain type aliases (`type Foo = innerast.Foo`) for the package's exported API surface, produced by `go run ./tools/gen_shims` from `packages/ttsc`. Regenerating overwrites it.
- **`shim.go` — hand-maintained.** First line `// gen_shims:hand-maintained`; the generator detects that marker and skips the file. This is where wrapper funcs and `//go:linkname` declarations live. Extra files like `ast/parent.go` are also hand-maintained.

Per-directory `extra-shim.json` feeds the generator the symbols it cannot derive on its own: `ExtraFunctions` (unexported funcs to linkname), `ExtraMethods`, `ExtraFields`, and `IgnoreFunctions` (exported funcs the generator should skip because a hand-written variant exists).

Pick the mechanism by what the symbol is:

- **Exported type** → type alias in `surface.go` (let the generator add it), e.g. `type Node = innerast.Node`.
- **Exported func that the generator skips** (e.g. its signature names an unexported type) → hand-write a wrapper func in `shim.go`, like `func SetParentInChildren(node *Node) { innerast.SetParentInChildren(node) }`.
- **Unexported symbol** → `//go:linkname`, like the `GetSourceFileOfNode` / `GetNodeAtPosition` entries in `ast/shim.go`. Add an `_ "unsafe"` import and declare the func with no body.

## Adding a missing API a plugin needs

The common task: a plugin needs a typescript-go symbol that the shim does not yet re-export.

1. Find the symbol in the pinned typescript-go source under the module cache: `go env GOMODCACHE`/`github.com/microsoft/typescript-go@<version>/internal/<pkg>/`. Confirm its exact name, signature, and whether it is exported.
2. Add the re-export to the matching `shim/<pkg>/`:
   - exported func with a clean signature → re-run `go run ./tools/gen_shims` (or add a wrapper in `shim.go` if the generator skips it);
   - exported type → add the alias in `surface.go` via the generator;
   - unexported symbol → add a `//go:linkname` declaration in `shim.go`.
3. Build the shim module and `packages/ttsc` to verify it links.

Recent worked example: `ast.SetParentInChildren` was exposed in `shim/ast/parent.go` as a thin wrapper so a transform can re-parent synthetic nodes before emit (the emit resolver dereferences `Parent` and would hit nil otherwise). For an unexported symbol the pattern is the linkname form already in `ast/shim.go`.

## Bumping the pinned typescript-go version

The version is pinned per shim module: `require github.com/microsoft/typescript-go v0.0.0-<timestamp>-<hash>` in every `shim/*/go.mod`, kept identical across all of them and also referenced as an indirect require in `packages/ttsc/go.mod`. The sibling `go.work` wires the shim sub-modules; tagged upstream versions can later replace these local wires.

To bump:

1. Update the `require` line to the new pseudo-version in every `shim/*/go.mod` (keep them all the same) and in `packages/ttsc/go.mod`, then refresh each `go.sum`.
2. Re-run `go run ./tools/gen_shims` from `packages/ttsc` to regenerate `surface.go` against the new source.
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

- **Enum families (zero-tolerance).** `shim/<pkg>/enums_gen.go` completes every exposed enum family, re-exporting any member not already re-exported in the package's `shim.go`/`surface.go`; the gate fails on any partial enum. After a typescript-go bump, run `pnpm --filter ttsc shim:audit -fix` to regenerate it. This is the `SignatureKindConstruct` (#230) class.
- **Reachable funcs / escaping types (ratcheted).** `tools/shim_audit/baseline.json` grandfathers the current backlog; the gate fails on any _new_ gap. Expose the symbol, or run `pnpm --filter ttsc shim:audit -write-baseline` to accept it deliberately.
- **Producer closure (zero-tolerance).** Every pointer-like compiler object consumed by a public shim operation must come from a public operation return, a callback supplied by the compiler, or a reasoned public root in `baseline.json`'s `producer_exemptions`. The audit covers package functions, hand-written methods, and method sets published by exposed aliases. `-write-baseline` never infers or accepts producer exemptions. Add an exported producer when the object represents compiler state; exempt only caller-owned configuration, nullable optional inputs, and equivalent roots with a non-empty rationale.
- **Unexported helpers.** Closure cannot predict these (a new consumer's first ask for an internal helper); the audit lists them as a demand pool. Expose with the `//go:linkname` pattern above (`Checker_getMinArgumentCount` is the worked example).

## Traversal-completeness probes

Closure and the audit only see whether a symbol is _nameable_ or whether a composition _compiles_. They cannot see a _runtime dead-end_: an exposed graph-walk op that silently can't reach part of the graph. `Checker_getBaseTypes` nil-derefs on a generic `Reference` base, so a base-chain walk dead-ends at the generic boundary — invisible to the audit, surfaced only when a consumer crashes (#246).

Catch that class with a runtime probe over a ttsc-owned fixture. The probe must use the exposed traversal and assert that it reaches the expected endpoint; compilation alone proves linkage, not traversal completeness.

The worked examples are `packages/lint/test/shim/base_chain_walk_crosses_generic_boundary_test.go` and `packages/lint/test/shim/signature_introspection_reaches_runtime_endpoints_test.go`. They build a real Checker through the lint host's `loadProgram`. The first proves the naive base walk stops before `Base` while the declared-type bridge reaches it. The second obtains real construct and call signatures through the shim, then asserts minimum and declared arity, parameters, rest elements, and return types for `()`, `(x?)`, `(x)`, `(...xs)`, and `(x, ...rest)`.

Keep these probes in `packages/lint/test/`, the ttsc-owned Go harness with a Checker over source, and run them through `pnpm test:go`. Add a fixture and endpoint assertion whenever a new graph-walk operation could introduce a silent dead end.
