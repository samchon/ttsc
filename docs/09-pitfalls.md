# Pitfalls

Common failures and direct fixes.

## `native.source.dir does not exist`

Your tarball missed the Go source or the manifest used a relative runtime path.

Fix `package.json`:

```json
"files": ["plugin.cjs", "go-plugin"]
```

Fix `plugin.cjs`:

```js
source: { dir: path.resolve(__dirname, "go-plugin") }
```

Verify:

```bash
npm pack --dry-run
```

## Shim Import Cannot Resolve

Error:

```text
no required module provides package github.com/microsoft/typescript-go/shim/ast
```

Fix `go.mod`:

```text
require github.com/microsoft/typescript-go/shim/ast v0.0.0
```

For local editor support, also configure `go.work`; see [Local Development](./04-local-dev.md).

## pnpm Cannot Find `node_modules/ttsc`

For plugin development repos, add one of:

```ini
node-linker=hoisted
```

or:

```ini
public-hoist-pattern[]=ttsc
```

Then reinstall.

## Options Are Ignored

You declared `--plugins-json` but never parsed it. The user's tsconfig options live there, not in environment variables.

Parse it and find your entry by `mode` or `name`.

## Combining Plugins

Multiple `compilerOptions.plugins[]` entries are supported. The limit is about ownership of the emit pass, not the number of plugin entries.

This works with TypeScript-Go's normal emit path:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ttsc/banner", "banner": "/*! license */" },
      { "transform": "@ttsc/paths" }
    ]
  }
}
```

`@ttsc/banner` and `@ttsc/paths` are output plugins, so they run after TypeScript-Go emits files.

This works with a compiler backend:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ttsc/lint", "config": { "no-var": "error" } },
      { "transform": "my-compiler-backend" }
    ]
  }
}
```

`@ttsc/lint` is a check plugin, so it runs before the compiler backend.

This fails when the entries resolve to different compiler backend binaries:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "compiler-backend-a" },
      { "transform": "compiler-backend-b" }
    ]
  }
}
```

If your plugin only edits emitted files, make it an output plugin:

```js
capabilities: ["output"]
```

If several compiler-backend modes must cooperate inside one compiler pass, put them in one binary and dispatch by ordered `--plugins-json`.

## Windows Path Failures

Normalize before comparing:

```go
filepath.ToSlash(path)
```

Do not hard-code the cached binary name as `plugin`; on Windows it is `plugin.exe`.

## Bad Text Ranges

`node.Pos()` can include leading trivia. For token starts:

```go
pos := shimscanner.SkipTrivia(file.Text(), node.Pos())
```

For diagnostics:

```go
pos := shimscanner.GetTokenPosOfNode(node, file, false)
```

## Cache Did Not Rebuild

Only source-like files affect the plugin binary cache:

```text
*.go, *.s, *.c, *.h, *.cpp, *.hpp, go.mod, go.sum, go.work
```

If you changed data files, embed them with `//go:embed` or run:

```bash
npx ttsc clean
```

## Runtime Output Fails

If a compiler-backend plugin emits CommonJS manually, mirror TypeScript-Go's expected boilerplate:

```js
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.name = void 0;
```

Output plugins avoid most of this by editing TypeScript-Go's emitted JavaScript instead of generating a whole file.
