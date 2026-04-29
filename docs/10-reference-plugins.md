# Reference Plugins

This repository ships four package-shaped plugins. Study them in this order:

1. `@ttsc/banner`
2. `@ttsc/strip`
3. `@ttsc/paths`
4. `@ttsc/lint`

The order is by implementation difficulty. `strip` is easier than `paths`: `strip` only needs the emitted JS file in front of it; `paths` needs tsconfig and Program data to map aliases back to emitted files.

## Shared Package Shape

Each package has:

```text
packages/<name>/
|- package.json
|- src/index.cjs
|- go.mod
`- plugin/
   |- main.go
   `- <name>.go
```

The descriptor factory lives in `src/index.cjs`:

```js
const path = require("node:path");

module.exports = function createPlugin() {
  return {
    name: "@ttsc/name",
    native: {
      mode: "ttsc-name",
      source: {
        dir: path.resolve(__dirname, ".."),
        entry: "./plugin",
      },
      contractVersion: 1,
      capabilities: ["output"],
    },
  };
};
```

The package root is `source.dir` because `go.mod` is at the package root. The binary entry is `./plugin`.

## `@ttsc/banner`

Path: [`packages/banner`](../packages/banner/)

Purpose: prepend a configured comment to emitted JavaScript and declaration files.

Consumer config:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/banner",
        "banner": "/*! @license MIT */"
      }
    ]
  }
}
```

What to learn:

- Minimal `["output"]` plugin descriptor.
- Finding the plugin's config from `--plugins-json`.
- Filtering output file extensions.
- Idempotent transform: skip when the banner already exists.
- Clean error messages for invalid config.

Read:

- [`packages/banner/src/index.cjs`](../packages/banner/src/index.cjs)
- [`packages/banner/plugin/main.go`](../packages/banner/plugin/main.go)
- [`packages/banner/plugin/banner.go`](../packages/banner/plugin/banner.go)
- [`tests/utility-plugins/banner/plugin/banner_test.go`](../tests/utility-plugins/banner/plugin/banner_test.go)

Use this as the template for simple post-emit file edits.

## `@ttsc/strip`

Path: [`packages/strip`](../packages/strip/)

Purpose: remove configured call-expression statements and `debugger` statements from emitted JavaScript.

Consumer config:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/strip",
        "calls": ["console.log", "console.debug", "assert.*"],
        "statements": ["debugger"]
      }
    ]
  }
}
```

What to learn:

- Parse emitted JS with `shim/parser`.
- Walk `SourceFile.Statements` and recurse with `node.ForEachChild`.
- Match `ExpressionStatement -> CallExpression`.
- Convert a callee AST into a dotted name such as `console.log`.
- Remove a whole statement by computing a source range.
- Apply text edits from the end of the file to the start.

Key AST flow:

```text
SourceFile
`- Statements
   `- ExpressionStatement
      `- CallExpression
         `- PropertyAccessExpression
            |- Identifier(console)
            `- Identifier(log)
```

Read:

- [`packages/strip/src/index.cjs`](../packages/strip/src/index.cjs)
- [`packages/strip/plugin/strip.go`](../packages/strip/plugin/strip.go)
- [`tests/utility-plugins/strip/plugin/strip_test.go`](../tests/utility-plugins/strip/plugin/strip_test.go)

Then compare the AST discussion in [AST and Checker](./03-tsgo.md#recognizing-calls).

## `@ttsc/paths`

Path: [`packages/paths`](../packages/paths/)

Purpose: rewrite emitted module specifiers that match `compilerOptions.paths` into relative output paths.

Consumer config:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["./src/modules/*"]
    },
    "rootDir": "src",
    "outDir": "dist",
    "plugins": [
      { "transform": "@ttsc/paths" }
    ]
  }
}
```

What to learn:

- Output plugins can still load tsconfig and Program data.
- `tsoptions.GetParsedCommandLineOfConfigFile` is the right way to read compiler options.
- Path alias resolution must use real project source files, not string guessing alone.
- More-specific path patterns should win before broad wildcard patterns.
- The plugin must handle JS and declaration syntax:
  - `import ... from "..."`
  - `export ... from "..."`
  - `require("...")`
  - dynamic `import("...")`
  - `import("...").T` in declarations

Mental model:

```text
emitted specifier "@lib/message"
-> match compilerOptions.paths pattern "@lib/*"
-> candidate source "./src/modules/message.ts"
-> Program confirms that source file exists
-> map source path through rootDir/outDir
-> rewrite to "./modules/message.js"
```

Read:

- [`packages/paths/src/index.cjs`](../packages/paths/src/index.cjs)
- [`packages/paths/plugin/paths.go`](../packages/paths/plugin/paths.go)
- [`tests/utility-plugins/paths/plugin/paths_test.go`](../tests/utility-plugins/paths/plugin/paths_test.go)
- [`tests/smoke/test/utility-plugins.test.cjs`](../tests/smoke/test/utility-plugins.test.cjs)

Then compare [AST and Checker](./03-tsgo.md#recognizing-imports-and-module-specifiers).

## `@ttsc/lint`

Path: [`packages/lint`](../packages/lint/)

Purpose: report ESLint-style diagnostics from TypeScript-Go's Program and Checker path.

Consumer config:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "rules": {
          "no-var": "error",
          "no-explicit-any": "warning"
        }
      }
    ]
  }
}
```

What to learn:

- Check-plugin placement: lint inspects authored source before emit and output plugins run.
- Program/Checker bootstrap for diagnostics.
- Rule registry keyed by rule name.
- Rule dispatch by `shimast.Kind`.
- Token-oriented diagnostic ranges with `shim/scanner`.
- Rendering lint diagnostics beside TypeScript-Go diagnostics.

Core architecture:

```text
compile.go
  parses CLI flags
  loads Program
  runs compiler diagnostics
  runs lint Engine
  renders diagnostics

engine.go
  maps Kind -> active rules
  walks user SourceFiles
  calls rule.Check(ctx, node)

rules_*.go
  implement Rule{Name, Visits, Check}
```

Read:

- [`packages/lint/src/index.cjs`](../packages/lint/src/index.cjs)
- [`packages/lint/plugin/config.go`](../packages/lint/plugin/config.go)
- [`packages/lint/plugin/host.go`](../packages/lint/plugin/host.go)
- [`packages/lint/plugin/engine.go`](../packages/lint/plugin/engine.go)
- [`packages/lint/plugin/compile.go`](../packages/lint/plugin/compile.go)
- [`packages/lint/plugin`](../packages/lint/plugin/)
- [`tests/lint/cases`](../tests/lint/cases/)

Use this design only when you need source diagnostics or semantic analysis. For output rewrites, prefer the smaller `banner`, `strip`, or `paths` shapes.

## Combined Pipeline

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["./src/modules/*"]
    },
    "rootDir": "src",
    "outDir": "dist",
    "plugins": [
      { "transform": "@ttsc/lint", "rules": { "no-var": "error" } },
      { "transform": "@ttsc/banner", "banner": "/*! @license MIT */" },
      { "transform": "@ttsc/paths" },
      {
        "transform": "@ttsc/strip",
        "calls": ["console.log", "console.debug", "assert.*"],
        "statements": ["debugger"]
      }
    ]
  }
}
```

Execution:

1. `@ttsc/lint check` runs first.
2. TypeScript-Go emits files.
3. `@ttsc/banner output` prepends comments.
4. `@ttsc/paths output` rewrites specifiers.
5. `@ttsc/strip output` removes debug statements.

Pinned by: `utility plugins: lint, banner, paths, and strip run together in ttsc build` in [`tests/smoke/test/utility-plugins.test.cjs`](../tests/smoke/test/utility-plugins.test.cjs).
