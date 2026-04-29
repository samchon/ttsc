# Local Development

Consumers do not need Go installed. Plugin authors usually do, because direct `go test`, `go vet`, and gopls feedback are much faster than running `ttsc` for every edit.

## Basic Loop

For a plugin that does not import TypeScript-Go shims:

```bash
go test ./go-plugin/...
go vet ./go-plugin/...
go build ./go-plugin
```

That is enough for output plugins like a banner rewriter.

## Shim-Using Plugins

If your plugin imports `github.com/microsoft/typescript-go/shim/...`, add `ttsc` as a dev dependency:

```bash
npm i -D ttsc
```

Then create `go.work` at the plugin repo root:

```text
go 1.26

use (
	./go-plugin
	./node_modules/ttsc
	./node_modules/ttsc/shim/ast
	./node_modules/ttsc/shim/bundled
	./node_modules/ttsc/shim/checker
	./node_modules/ttsc/shim/compiler
	./node_modules/ttsc/shim/core
	./node_modules/ttsc/shim/diagnosticwriter
	./node_modules/ttsc/shim/parser
	./node_modules/ttsc/shim/scanner
	./node_modules/ttsc/shim/tsoptions
	./node_modules/ttsc/shim/tspath
	./node_modules/ttsc/shim/vfs
	./node_modules/ttsc/shim/vfs/cachedvfs
	./node_modules/ttsc/shim/vfs/osvfs
)
```

You can list only the shims you use. Listing all is harmless and keeps editor setup simple.

## `go.mod`

Every imported shim still needs a `require` line:

```text
require github.com/microsoft/typescript-go/shim/ast v0.0.0
```

The `go.work` file tells Go where `v0.0.0` lives locally. Without the `require`, gopls and `go test` will still complain.

## pnpm

The `go.work` above assumes `./node_modules/ttsc` exists. With pnpm's isolated linker it may not.

Recommended for plugin development repos:

```ini
# .npmrc
node-linker=hoisted
```

Alternative:

```ini
public-hoist-pattern[]=ttsc
```

This affects only your plugin repo's development layout. Published plugins still work in consumer projects with npm, pnpm, yarn, or other package managers.

## Ignore

Commit `go.work`; ignore machine-specific data:

```gitignore
node_modules/
go.work.sum
```

## After a `ttsc` Upgrade

Run:

```bash
npm update ttsc
go test ./go-plugin/...
go vet ./go-plugin/...
```

If TypeScript-Go moved a shim symbol you use, the Go compile error points at the exact call site.
