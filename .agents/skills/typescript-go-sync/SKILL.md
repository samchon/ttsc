---
name: typescript-go-sync
description: Defines how packages/ttsc/shim stays synchronized with typescript-go and complete for plugin authors. Use before adding a shim re-export, bumping the pinned typescript-go version, or investigating a missing AST, transform, printer, checker, or emit API.
---

# TypeScript-Go Shim Sync

## Why the shim exists

`ttsc` is built on typescript-go, the Go port of `tsc` at module `github.com/microsoft/typescript-go`. Most compiler APIs live under that module's `internal/*` tree, which another Go module cannot import directly.

`packages/ttsc/shim/<name>` is the legal bridge. Each shim directory (`ast`, `checker`, `compiler`, `core`, `printer`, `scanner`, `parser`, `tsoptions`, `tspath`, `vfs`, and others) is its own Go module wrapping the matching `internal/<name>` package.

The shim is the only typescript-go surface available to source-plugin authors such as typia, nestia, and third-party rules. Keep it synchronized with the AST, transform, printer, checker and emit APIs present in unmodified upstream, under [AGENTS.md's compiler boundary](../../../AGENTS.md#attitude). A missing re-export of an existing upstream API is a ttsc bug, not a plugin bug.

## Shim structure

Each `shim/<name>/` directory has generated and hand-maintained files:

- **Generated `shim.go`, do not edit.** From `packages/ttsc`, `go run '-modfile=tools/gen_shims/go.mod' ./tools/gen_shims/main.go` writes the exported aliases and linkname declarations for shim packages whose `shim.go` does not opt out of generation. The generator owns a separate Go module; the file-list invocation preserves its dependencies and the compiler-relative source/output roots.
- **Hand-maintained files.** A `shim.go` that starts with `// gen_shims:hand-maintained` is not regenerated. Keep wrappers and `//go:linkname` declarations there or in another hand-maintained file such as `ast/parent.go`.
- **Package-specific generated support files.** Some packages also have files such as `surface.go` or `enums_gen.go`. Follow their generated-file header and regenerate them with their owning command; do not create one merely to expose a symbol.

Per-directory `extra-shim.json` feeds the generator the symbols it cannot derive on its own: `ExtraFunctions` (unexported funcs to linkname), `ExtraMethods`, `ExtraFields`, and `IgnoreFunctions` (exported funcs the generator should skip because a hand-written variant exists).

`ExtraFieldFiles` routes a selected type's `ExtraFields` to a named `*_gen.go` support file with private accessors. Use it when a hand-maintained shim needs one upstream field: the generator derives the complete struct layout while the maintained operation owns the field's usable lifetime. It does not enable the other fields configured for the skipped `shim.go`. Keep compiler state borrowed through a scoped operation rather than publishing an uninitialized field value as a producer.

Pick the mechanism by what the symbol is:

- **Exported type**: re-run the generator when it can derive the alias. Otherwise add the alias to a hand-maintained file; do not create a generic `surface.go`.
- **Exported func that the generator skips**: add a thin wrapper in a hand-maintained file.
- **Unexported symbol**: add a `//go:linkname` declaration to a hand-maintained file, import `_ "unsafe"`, and declare the function with no body.

## Adding a missing API a plugin needs

The common task: a plugin needs a typescript-go symbol that the shim does not yet re-export.

1. Find the symbol in the pinned typescript-go source under the module cache: `go env GOMODCACHE`/`github.com/microsoft/typescript-go@<version>/internal/<pkg>/`. Confirm its exact name, signature, and whether it is exported.
2. Add the re-export to the matching `shim/<pkg>/` with the mechanism [Shim structure](#shim-structure) assigns to that kind of symbol: the compiler-relative generator command above for what the generator derives, a hand-maintained file for an exported symbol it cannot derive, or a `//go:linkname` declaration for an unexported symbol.
3. Build the shim module and `packages/ttsc` to verify it links.

## Bumping the pinned typescript-go version

The version is pinned per shim module: `require github.com/microsoft/typescript-go v0.0.0-<timestamp>-<hash>` in every shim `go.mod`, kept identical with `packages/ttsc/go.mod` and the consumer modules that pin upstream directly. The compiler module's local `replace` directives resolve maintained shims; source-plugin consumers receive their modules through the generated workspace. A local upstream checkout is not required.

To bump:

1. Update the `require` line in every shim, the compiler module and each directly pinned consumer module, then refresh their sums using their actual module or generated workspace resolution. Placeholder shim versions cannot be resolved from the public proxy; do not add permanent absolute replacements to make standalone tidy succeed. Verify the resulting module files and effective workspace build list: `go work sync` can finish successfully while leaving a module unchanged when its standalone dependency resolution fails. Refresh that module's existing external requirements from the verified build list with `go mod edit -require`, then record their checksums with `go mod download`; distinguish this from a successful standalone tidy.
2. Run the generator from `packages/ttsc` with `GOWORK=off`: `go run '-modfile=tools/gen_shims/go.mod' ./tools/gen_shims/main.go`.
3. Re-check the hand-maintained `shim.go` files and `extra-shim.json` entries: an upstream rename, signature change, or export/unexport flip can break a wrapper or linkname. Build `packages/ttsc` and fix the fallout.

Document public signature migrations and borrowed-state lifetimes in the [AST and Checker guide](../../../website/src/content/docs/development/concepts/tsgo.mdx). Preserve previously exported enum families when regenerating: existing generated constants identify a public family, while its required members come from the current upstream type. Exclude previous generated members from the calculation of replacement contents, verify repeated generation is idempotent, and remove obsolete output only after authored exports own every member. Trace an actual upstream removal before deciding its compatibility treatment.

## Validating a shim change in a real consumer

A shim change is only proven by a downstream plugin compiling and passing against it. Build the ttsc tarballs and install them into a consumer checkout:

```bash
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 -r --workspace-concurrency=1 build
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 exec pnpm pack --out "../../experimental/tarballs/%s.tgz"
```

Install the produced tarballs into `../typia` (or another consumer) and run a relevant typia test that exercises the new API. Name the host platform package in place of `ttsc-linux-x64`; typia.yml and nestia.yml run exactly these two commands.

## Mechanical completeness gate

`packages/ttsc/tools/shim_audit` enforces shim completeness in CI (the `shim-audit` job runs `pnpm --filter ttsc shim:audit`) so the recurring "missing re-export" class cannot return. It treats the shim as a closure: if a type is aliased, everything reachable from it should be reachable through the shim. Four layers:

- **Enum families (zero-tolerance).** `shim/<pkg>/enums_gen.go` completes every exposed enum family, re-exporting any member not already exposed by the package. The gate fails on any partial enum or previously public constant absent from upstream. After a typescript-go bump, run `pnpm --filter ttsc shim:audit -fix` to regenerate it. An upstream removal makes generation refuse all writes; resolve the removed member's migration before proceeding.
- **Reachable funcs / escaping types (ratcheted).** `tools/shim_audit/baseline.json` grandfathers the current backlog; the gate fails on any _new_ gap. Expose the symbol, or run `pnpm --filter ttsc shim:audit -write-baseline` to accept it deliberately.
- **Producer closure (zero-tolerance).** Every pointer-like compiler object consumed by a public shim operation must come from a reachable public operation, a callback supplied by the compiler, or a reasoned root or ownership boundary in `baseline.json`'s `producer_exemptions`. The audit follows direct and named callback/container contracts across package functions, hand-written methods, and method sets published by exposed aliases. Operation results unlock only after their compiler-object inputs and receiver are obtainable, so rootless function or method cycles do not satisfy the gate. `-write-baseline` never infers or accepts producer exemptions. Expose an existing upstream producer when the object represents plugin-usable compiler state. Exempt only caller-owned configuration, nullable optional inputs, or host/compiler-owned state outside the supported plugin entry points, and give every exemption a non-empty rationale. Automatic exposure alone is not an exemption.
- **Unexported helpers.** Closure cannot predict these. The audit lists them as a demand pool; expose a needed helper with the `//go:linkname` pattern above.

## Traversal-completeness probes

Closure and the audit prove that a symbol is _nameable_ and a composition _compiles_. They cannot prove that an exposed graph-walk operation reaches every required node at runtime.

For every new graph-walk operation, add a runtime probe over a ttsc-owned fixture. Use the exposed traversal and assert that it reaches the expected endpoint; compilation alone proves linkage, not traversal completeness.

Keep traversal probes in `packages/lint/test/shim/`. Build a real Checker through the lint host's `loadProgram`, then exercise generic references and every supported signature shape through the public shim.

Run these probes through `pnpm test:go`. Add a fixture and endpoint assertion whenever a new graph-walk operation could introduce a silent dead end.
