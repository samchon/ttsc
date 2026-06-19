---
name: typescript-go-sync
description: Keeping packages/ttsc/shim/* synced with typescript-go and complete for plugin authors. Read before adding a re-export, bumping the pinned typescript-go version, or chasing a missing AST/transform/printer/emit API a plugin needs.
---

# TypeScript-Go Shim Sync

## Why the shim exists

`ttsc` is built on top of typescript-go (the Go port of `tsc`, module `github.com/microsoft/typescript-go`). Almost all of its real compiler surface lives under that module's `internal/*` packages, and Go forbids importing another module's `internal/` tree. So ttsc re-exports the pieces it needs through `packages/ttsc/shim/<name>`, where each shim sub-module (`ast`, `checker`, `compiler`, `core`, `printer`, `scanner`, `parser`, `tsoptions`, `tspath`, `vfs`, ...) is its own Go module that wraps the matching `internal/<name>` package.

Keeping this shim synced and complete is a core purpose of ttsc, not a chore. The shim is the only typescript-go surface that source-plugin authors (typia, nestia, and third-party rules) can touch. The job is to track typescript-go source changes and expose EVERY AST, transform, printer, and emit API a plugin needs, so plugins never have to reach into `internal/` themselves. A missing re-export is an ttsc bug, not a plugin bug.

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
TTSC_TARBALLS_CURRENT=1 pnpm package:tgz
```

Install the produced tarballs into `../typia` (or another consumer) and run a relevant typia test that exercises the new API. The `experimental/tarballs/index.ts` flow is what CI uses; `--current` / `TTSC_TARBALLS_CURRENT=1` packs only the current-platform package for a quick loop.

## Mechanical completeness gate

`packages/ttsc/tools/shim_audit` enforces shim completeness in CI (the `shim-audit` job runs `pnpm --filter ttsc shim:audit`) so the recurring "missing re-export" class cannot return. It treats the shim as a closure: if a type is aliased, everything reachable from it should be reachable through the shim. Three layers:

- **Enum families (zero-tolerance).** `shim/<pkg>/enums_gen.go` completes every exposed enum family, re-exporting any member not already re-exported in the package's `shim.go`/`surface.go`; the gate fails on any partial enum. After a typescript-go bump, run `pnpm --filter ttsc shim:audit -fix` to regenerate it. This is the `SignatureKindConstruct` (#230) class.
- **Reachable funcs / escaping types (ratcheted).** `tools/shim_audit/baseline.json` grandfathers the current backlog; the gate fails on any _new_ gap. Expose the symbol, or run `pnpm --filter ttsc shim:audit -write-baseline` to accept it deliberately.
- **Unexported helpers.** Closure cannot predict these (a new consumer's first ask for an internal helper); the audit lists them as a demand pool. Expose with the `//go:linkname` pattern above (`Checker_getMinArgumentCount` is the worked example).

## Traversal-completeness probes

Closure and the audit only see whether a symbol is _nameable_ or whether a composition _compiles_. They cannot see a _runtime dead-end_: an exposed graph-walk op that silently can't reach part of the graph. `Checker_getBaseTypes` nil-derefs on a generic `Reference` base, so a base-chain walk dead-ends at the generic boundary — invisible to the audit, surfaced only when a consumer crashes (#246).

The net for that class is a runtime probe that exercises the exposed traversal over a ttsc-owned fixture and asserts it _completes_. The worked example is `packages/lint/test/shim/base_chain_walk_crosses_generic_boundary_test.go`: it builds a real Checker via the lint host's `loadProgram`, walks a `Base{#brand} <- Mid<T> <- Sub extends Mid<string>` chain through only the exposed shim ops, and asserts the naive walk dead-ends before `Base` (the gap is real) while the `getDeclaredTypeOfSymbol`-bridged walk reaches it. These live in `packages/lint/test/` (the only ttsc-owned Go harness with a Checker-over-source) and run in `pnpm test:go`. When you expose a new graph-walk op, add a fixture + completeness assertion so its dead-ends can't silently return — prefer this over a compile-only guard, which proves linkage but not traversal.
