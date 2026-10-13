---
name: typescript-go-sync
description: Keeps packages/ttsc/shim synchronized with typescript-go and complete for plugin authors. Use before adding a shim re-export, bumping typescript-go, changing the shim audit, or chasing a missing compiler API.
---

# TypeScript-Go Shim

Each `packages/ttsc/shim/<name>` is a Go module re-exporting typescript-go's `internal/<name>`, the only compiler surface plugins can use. A missing re-export of an API in unmodified upstream is a ttsc bug.

## Adding An API

1. Find the symbol under `$(go env GOMODCACHE)/github.com/microsoft/typescript-go@<version>/internal/<pkg>/`.
2. If the generator derives it, run `go run '-modfile=tools/gen_shims/go.mod' ./tools/gen_shims/main.go` in `packages/ttsc`; generated `shim.go` files are never edited. Otherwise add it to a file marked `// gen_shims:hand-maintained`, or to the directory's `extra-shim.json`, using a bodiless `//go:linkname` declaration with `import _ "unsafe"` for an unexported symbol.

## Bumping typescript-go

1. Update the identical `require github.com/microsoft/typescript-go v0.0.0-<timestamp>-<hash>` in every shim, `packages/ttsc/go.mod`, and each consumer that pins it, and refresh sums through the real module or workspace resolution. Never add permanent absolute replacements. `go work sync` can succeed while leaving a module stale; then set its requirements with `go mod edit -require` and run `go mod download`.
2. Run the generator with `GOWORK=off`, then `pnpm --filter ttsc shim:audit -fix`.
3. Fix hand-maintained files and `extra-shim.json` for upstream renames, signature changes, and export flips, keep previously exported enum families, and document public migrations in the [AST and Checker guide](../../../website/src/content/docs/development/concepts/tsgo.mdx).

## Audit

CI runs `pnpm --filter ttsc shim:audit`. Accept a new gap into `tools/shim_audit/baseline.json` with `-write-baseline` only on purpose, and give every `producer_exemptions` entry a rationale. The audit proves only that code compiles, so add a runtime probe in `packages/lint/test/shim/` for each new graph-walk operation.

## Consumer Validation

A shim change is proven only by a downstream plugin passing against it. Build and pack with your platform package, install the tarballs into `../typia` or another consumer, and run a test that uses the API:

```bash
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 -r --workspace-concurrency=1 build
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 exec pnpm pack --out "../../experimental/tarballs/%s.tgz"
```
