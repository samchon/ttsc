---
name: typescript-go-sync
description: Keeps ttsc's compiler-target shims synchronized with TypeScript-Go and complete for plugin authors. Use before adding a shim re-export, bumping a target's compiler, changing the shim audit or generators, or chasing a missing compiler API.
---

# TypeScript-Go Shim

The shims are the only compiler surface plugins can use, one tree per compiler target. A missing re-export of an API in unmodified upstream is a ttsc bug.

| Target | Shims | Compiler module | Generator and audit flags |
| --- | --- | --- | --- |
| 7.0 | `packages/ttsc/shim/<name>`, modules `github.com/microsoft/typescript-go/shim/<name>` | `github.com/microsoft/typescript-go` | defaults; `tools/shim_audit/baseline.json` |
| 7.1 | bridges `packages/ttsc/targets/7.1/bridge/<name>`, modules `github.com/microsoft/TypeScript/tsc/shim/<name>`, and generated facades `targets/7.1/facade/<name>` at the 7.0 module paths | `github.com/microsoft/TypeScript/tsc` | `-shim ./targets/7.1/bridge -internal github.com/microsoft/TypeScript/tsc/internal/`; `baseline-7.1.json` |

Go admits an import of a module's `internal/` tree only from a path rooted at that module, so 7.1 code that reaches the compiler lives in the bridges, and the facades only alias them. The 7.1 modules are standalone: run their Go commands with `GOWORK=off`.

## Adding An API

1. Find the symbol under the target's compiler module in `$(go env GOMODCACHE)`.
2. If the generator derives it, run `go run '-modfile=tools/gen_shims/go.mod' ./tools/gen_shims/main.go` in `packages/ttsc` with the target's flags; generated files are never edited, and `-check` reports drift. Otherwise list it in the directory's `extra-shim.json`, or write it in a file marked `// gen_shims:hand-maintained`, where an unexported symbol takes a bodiless `//go:linkname` declaration with `import _ "unsafe"`.
3. After a 7.1 bridge changes, regenerate its facades with `pnpm --filter ttsc shim:facade`.

## Bumping A Compiler

1. Update the identical compiler `require` line in every shim or bridge of the target and in each consumer that pins it, and refresh sums through the real module or workspace resolution. Never add permanent absolute replacements. `go work sync` can succeed while leaving a module stale; then set its requirements with `go mod edit -require` and run `go mod download`.
2. Run the generator with `GOWORK=off`, then `pnpm --filter ttsc shim:audit -fix`, and regenerate 7.1 facades.
3. For the 7.1 target, set `TYPESCRIPT_7_1` in `tests/test-e2e/src/features/ttsc/os-boundaries/source-plugin/case_installed_ttsc_builds_each_typescript_line_against_its_own_compiler.ts` to the `typescript` nightly whose `gitHead` is the new commit.
4. Fix hand-maintained files and `extra-shim.json` for upstream renames, signature changes, and export flips, keep previously exported enum families, and document public migrations in the [AST and Checker guide](../../../website/src/content/docs/development/concepts/tsgo.mdx).

## Audit

CI runs `pnpm --filter ttsc shim:audit`, which audits every target and checks each bodiless `go:linkname` declaration against its target's signature. Accept a new gap into the target's baseline with `-write-baseline` only on purpose, and give every `producer_exemptions` entry a rationale. The audit proves only that code compiles, so add a runtime probe in `packages/lint/linthost/` that walks a Checker loaded through `loadProgram` for each new graph-walk operation.

## Consumer Validation

A shim change is proven only by a downstream plugin passing against it. Build and pack with your platform package, install the tarballs into `../typia` or another consumer, and run a test that uses the API:

```bash
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 -r --workspace-concurrency=1 build
pnpm --filter ttsc --filter @ttsc/unplugin --filter ./packages/ttsc-linux-x64 exec pnpm pack --out "../../experimental/tarballs/%s.tgz"
```
