# Reference Plugins

This repository ships four package-shaped plugins. Study them in this order:

1. `@ttsc/banner`
2. `@ttsc/strip`
3. `@ttsc/paths`
4. `@ttsc/lint`

The order is by implementation difficulty. `strip` is easier than `paths`: `strip` only needs the source AST in front of it; `paths` needs tsconfig and Program data to map aliases through the final output layout.

## Shared Package Shape

Each package has a JavaScript descriptor factory and a Go plugin module:

```text
packages/<name>/
|- package.json
|- src/index.cjs        # simple descriptor factory
|- src/index.ts         # typed package surface, compiled to lib/index.js
|- go.mod
`- plugin/
   |- main.go
   `- <name>.go
```

For a package with no public TypeScript types, the descriptor factory can live in `src/index.cjs`:

```js
const path = require("node:path");

module.exports = function createPlugin() {
  return {
    name: "@ttsc/name",
    source: path.resolve(__dirname, "..", "plugin"),
    stage: "transform",
  };
};
```

The `plugin` directory is inside the package root, so the source builder finds the package `go.mod` by walking upward.

For a package that exposes config types, put the descriptor in `src/index.ts` and export those types from the same root index.

`@ttsc/banner`, `@ttsc/lint`, `@ttsc/paths`, and `@ttsc/strip` are package-contract examples for plugin authors. Their user-facing READMEs describe install and config files; this chapter focuses on how each package is wired internally.

## `@ttsc/banner`

Path: [`packages/banner`](../packages/banner/)

Purpose: add a configured `@packageDocumentation` source JSDoc block so JavaScript and declaration emit both carry the banner.

Consumer config:

```ts
// banner.config.ts
import type { TtscBannerConfig } from "@ttsc/banner";

export default {
  text: "License MIT",
} satisfies TtscBannerConfig;
```

Use `compilerOptions.plugins` only for inline text or a non-default config path:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/banner",
        "config": "./config/banner.config.ts",
      },
    ],
  },
}
```

If no inline text, explicit `config`, or discovered banner config file exists, the build fails.

What to learn:

- Minimal transform plugin descriptor.
- Finding the plugin's config from `--plugins-json`.
- Loading project config from `banner.config.ts`.
- Formatting user banner text into compiler-owned JSDoc.
- Clean error messages for invalid config.

Read:

- [`packages/banner/src/index.ts`](../packages/banner/src/index.ts)
- [`packages/banner/plugin/main.go`](../packages/banner/plugin/main.go)
- [`packages/banner/plugin/banner.go`](../packages/banner/plugin/banner.go)
- [`tests/utility-plugins/banner/plugin/banner_test.go`](../tests/utility-plugins/banner/plugin/banner_test.go)

Use this as the template for simple source comment transforms.

## `@ttsc/strip`

Path: [`packages/strip`](../packages/strip/)

Purpose: remove configured call-expression statements and `debugger` statements from TypeScript source AST before emit.

Consumer `package.json`:

```json
{
  "devDependencies": {
    "@ttsc/strip": "^0.8.1"
  }
}
```

With no plugin options, `@ttsc/strip` removes `console.log`, `console.debug`, `assert.*`, and `debugger`. Add a `compilerOptions.plugins[]` entry when the project needs a different call or statement list.

What to learn:

- Mutate source `SourceFile.Statements` directly.
- Walk `SourceFile.Statements` and recurse with `node.ForEachChild`.
- Match `ExpressionStatement -> CallExpression`.
- Convert a callee AST into a dotted name such as `console.log`.
- Remove a whole statement by filtering the parent statement list.

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

Purpose: rewrite source module specifiers that match `compilerOptions.paths` into relative output paths. Declaration emit follows the same source AST rewrite.

Consumer `package.json`:

```json
{
  "devDependencies": {
    "@ttsc/paths": "^0.8.1"
  }
}
```

Consumer `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["./src/modules/*"],
    },
    "rootDir": "src",
    "outDir": "dist",
  },
}
```

What to learn:

- Transform plugins can still load tsconfig and Program data.
- `tsoptions.GetParsedCommandLineOfConfigFile` is the right way to read compiler options.
- Path alias resolution must use real project source files, not string guessing alone.
- More-specific path patterns should win before broad wildcard patterns.
- The plugin must handle module-specifier syntax that can affect emitted JS and declarations:
  - `import ... from "..."`
  - `export ... from "..."`
  - `require("...")`
  - dynamic `import("...")`
  - `import("...").T` type queries

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
- [`tests/test-utility-plugins/src/features/utility-plugins`](../tests/test-utility-plugins/src/features/utility-plugins/)

Then compare [AST and Checker](./03-tsgo.md#recognizing-imports-and-module-specifiers).

## `@ttsc/lint`

Path: [`packages/lint`](../packages/lint/)

Purpose: report ESLint-style diagnostics from TypeScript-Go's Program and Checker path.

Consumer `package.json`:

```json
{
  "devDependencies": {
    "@ttsc/lint": "^0.8.1"
  }
}
```

When `config` is not written in `tsconfig.json`, use `lint.config.*`, `ttsc-lint.config.*`, or a supported ESLint flat config file (`eslint.config.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, or `.cts`). If no config file exists, the build fails.

What to learn:

- Reporting diagnostics before emit.
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

- [`packages/lint/src/index.ts`](../packages/lint/src/index.ts)
- [`packages/lint/src/structures`](../packages/lint/src/structures/)
- [`packages/lint/plugin/config.go`](../packages/lint/plugin/config.go)
- [`packages/lint/plugin/host.go`](../packages/lint/plugin/host.go)
- [`packages/lint/plugin/engine.go`](../packages/lint/plugin/engine.go)
- [`packages/lint/plugin/compile.go`](../packages/lint/plugin/compile.go)
- [`packages/lint/plugin`](../packages/lint/plugin/)
- [`tests/test-lint/src/cases`](../tests/test-lint/src/cases/)

Use this design only when you need source diagnostics or semantic analysis. For source transforms, prefer the smaller `banner`, `strip`, or `paths` shapes.

## Combined Project

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@lib/*": ["./src/modules/*"],
    },
    "rootDir": "src",
    "outDir": "dist",
    "plugins": [
      { "transform": "@ttsc/banner", "config": "./banner.config.ts" },
      {
        "transform": "@ttsc/strip",
        "calls": ["console.log", "console.debug", "assert.*"],
        "statements": ["debugger"],
      },
    ],
  },
}
```

`banner.config.ts`:

```ts
import type { TtscBannerConfig } from "@ttsc/banner";

export default {
  text: "License MIT",
} satisfies TtscBannerConfig;
```

`lint.config.json`:

```json
{
  "no-var": "error"
}
```

Behavior:

- `@ttsc/lint` reports diagnostics before emit. It can use `lint.config.*`, `ttsc-lint.config.*`, supported ESLint flat config files, or direct plugin config.
- `@ttsc/banner` uses inline text, an explicit `config` path, or a banner config file.
- `@ttsc/paths` reads `compilerOptions.paths`, `rootDir`, and `outDir`.
- `@ttsc/strip` uses its defaults unless a direct plugin config overrides them.
- TypeScript-Go emits JavaScript, declarations, and maps.

Pinned by: `utility plugins: lint, banner, paths, and strip run together in ttsc build` in [`tests/test-utility-plugins/src/features/utility-plugins/test_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build.ts`](../tests/test-utility-plugins/src/features/utility-plugins/test_utility_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build.ts).
