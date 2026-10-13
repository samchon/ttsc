---
name: typescript-go-sync
description: Keeps packages/ttsc/shim synchronized with typescript-go and complete for plugin authors. Use before adding a shim re-export, bumping typescript-go, changing the shim audit, or chasing a missing compiler API.
---

# TypeScript-Go Shim

Each `packages/ttsc/shim/<name>` is a Go module re-exporting typescript-go's `internal/<name>`, the only compiler surface plugins can use. A missing re-export of an API in unmodified upstream is a ttsc bug.

## Files

- Generated `shim.go` files come from `go run '-modfile=tools/gen_shims/go.mod' ./tools/gen_shims/main.go` in `packages/ttsc`; never edit them.
- A `shim.go` starting with `// gen_shims:hand-maintained` is not regenerated and holds wrappers and `//go:linkname` declarations.
- `extra-shim.json` adds what the generator cannot derive: `ExtraFunctions`, `ExtraMethods`, `ExtraFields`, `IgnoreFunctions`, and `ExtraFieldFiles`, which emits one upstream field's private accessors into a `*_gen.go` file for a hand-maintained shim.

## Adding An API

1. Find the symbol under `$(go env GOMODCACHE)/github.com/microsoft/typescript-go@<version>/internal/<pkg>/`.
2. Regenerate if the generator derives it; otherwise add an alias or wrapper to a hand-maintained file, or a bodiless `//go:linkname` declaration with `import _ "unsafe"` for an unexported symbol.
3. Build the shim and `packages/ttsc`.

## Bumping typescript-go

1. Update the identical `require github.com/microsoft/typescript-go v0.0.0-<timestamp>-<hash>` in every shim, `packages/ttsc/go.mod`, and each consumer that pins it, and refresh sums through the real module or workspace resolution. Never add permanent absolute replacements. `go work sync` can succeed while leaving a module stale; then set its requirements with `go mod edit -require` and run `go mod download`.
2. Run the generator with `GOWORK=off`, then `pnpm --filter ttsc shim:audit -fix`.
3. Fix hand-maintained files and `extra-shim.json` for renames, signature changes, and export flips, and document public migrations in the [AST and Checker guide](../../../website/src/content/docs/development/concepts/tsgo.mdx). Keep previously exported enum families.

## Audit

CI runs `pnpm --filter ttsc shim:audit`, which treats the shim as a closure.

- Enum families and producer closure are zero-tolerance. Every compiler object a public operation consumes must come from a public operation, a compiler callback, or a reasoned `producer_exemptions` entry in `tools/shim_audit/baseline.json`.
- Other reachable gaps are ratcheted by that baseline; expose the symbol, or accept it on purpose with `-write-baseline`.
- For each new graph-walk operation, add a runtime probe in `packages/lint/test/shim/` that walks a real Checker to its endpoint, because the audit proves only that code compiles.

## Consumer Validation

A shim change is proven only by a downstream plugin passing against it. Build and pack with your platform package, install the tarballs into `../typia` or another consumer, and run a test that uses the API:

```bash
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 -r --workspace-concurrency=1 build
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 exec pnpm pack --out "../../experimental/tarballs/%s.tgz"
```
