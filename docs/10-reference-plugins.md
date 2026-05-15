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
|- src/index.cjs        # simple descriptor factory, when no typed surface is needed
|- src/index.ts         # typed package surface, compiled to lib/index.js when present
|- go.mod
`- plugin/
   |- main.go           # native sidecar entrypoint
   `- <name>.go         # package-local helper file or wrapper
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
- [`packages/ttsc/utility/host.go`](../packages/ttsc/utility/host.go)
- [`packages/banner/test`](../packages/banner/test/)
- [`packages/ttsc/test/utility`](../packages/ttsc/test/utility/)

Use this as the template for simple source comment transforms.

## `@ttsc/strip`

Path: [`packages/strip`](../packages/strip/)

Purpose: remove configured call-expression statements and `debugger` statements from TypeScript source AST before emit.

Install:

```bash
npm install -D @ttsc/strip
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
- [`packages/strip/plugin/main.go`](../packages/strip/plugin/main.go)
- [`packages/ttsc/utility/host.go`](../packages/ttsc/utility/host.go)
- [`packages/strip/test`](../packages/strip/test/)
- [`packages/ttsc/test/utility`](../packages/ttsc/test/utility/)

Then compare the AST discussion in [AST and Checker](./03-tsgo.md#recognizing-calls).

## `@ttsc/paths`

Path: [`packages/paths`](../packages/paths/)

Purpose: rewrite source module specifiers that match `compilerOptions.paths` into relative output paths. Declaration emit follows the same source AST rewrite.

Install:

```bash
npm install -D @ttsc/paths
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
- [`packages/paths/plugin/main.go`](../packages/paths/plugin/main.go)
- [`packages/ttsc/utility/host.go`](../packages/ttsc/utility/host.go)
- [`packages/paths/test`](../packages/paths/test/)
- [`packages/ttsc/test/utility`](../packages/ttsc/test/utility/)
- [`tests/test-paths/src/features`](../tests/test-paths/src/features/)

Then compare [AST and Checker](./03-tsgo.md#recognizing-imports-and-module-specifiers).

## `@ttsc/lint`

Path: [`packages/lint`](../packages/lint/)

Purpose: report ESLint-style diagnostics from TypeScript-Go's Program and Checker path.

Install:

```bash
npm install -D @ttsc/lint
```

When neither `rules` (inline severity map) nor `extends` (file path) is written in `tsconfig.json`, use `lint.config.*`, `ttsc-lint.config.*`, or a supported ESLint flat config file (`eslint.config.js`, `.mjs`, `.cjs`, `.ts`, `.mts`, or `.cts`). If no config file exists, the build fails.

Run `ttsc fix` (or `ttsc --fix`) to apply supported lint fixes before the final no-emit check. Native fixers are attached as source-text edits on rule findings; ESLint-backed configs delegate to ESLint's `fix` runtime and then reload the TypeScript-Go Program before diagnostics are rendered.

What to learn:

- Reporting diagnostics before emit.
- Program/Checker bootstrap for diagnostics.
- Rule registry keyed by rule name.
- Rule dispatch by `shimast.Kind`.
- Token-oriented diagnostic ranges with `shim/scanner`.
- Autofix text edits for selected native rules and ESLint runtime delegation.
- Rendering lint diagnostics beside TypeScript-Go diagnostics.

Core architecture:

```text
compile.go
  parses CLI flags
  loads Program
  runs compiler diagnostics
  runs lint Engine
  renders diagnostics

fix.go
  applies native text edits
  delegates ESLint runtime fixes
  reloads Program before final diagnostics

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
- [`packages/lint/plugin/fix.go`](../packages/lint/plugin/fix.go)
- [`packages/lint/plugin`](../packages/lint/plugin/)
- [`tests/test-lint/src/cases`](../tests/test-lint/src/cases/)

Use this design only when you need source diagnostics or semantic analysis. For source transforms, prefer the smaller `banner`, `strip`, or `paths` shapes.

### Authoring a Lint Rule Contributor

`@ttsc/lint` exposes a public Go module — `github.com/samchon/ttsc/packages/lint/rule` — that third-party packages import to register rules. ttsc's plugin builder statically links the contributor's Go source into `@ttsc/lint`'s binary via the protocol-level `contributors` field (see [Protocol: Contributors](./02-protocol.md#contributors)), so contributor rules share the same single AST walk and diagnostic stream as the built-in corpus.

A contributor package has three parts:

1. **JS descriptor** (`lib/index.js`, built from `src/index.ts`) — exports an `ITtscLintPlugin` object pointing at the Go source directory:

    ```ts
    import path from "node:path";
    import type { ITtscLintPlugin } from "@ttsc/lint";

    const plugin = {
      meta: { name: "ttsc-lint-plugin-demo", version: "1.0.0", namespace: "demo" },
      rules: ["no-todo-comment"] as const,
      source: path.resolve(__dirname, "..", "rules"),
    } satisfies ITtscLintPlugin;

    export default plugin;
    ```

2. **Go rule package** (`rules/*.go`) — `package <name>`, **no `go.mod`**, registers each rule from `init()`. The Go package name is the user-facing namespace with hyphens replaced by underscores (`react-hooks` → `package react_hooks`); the namespace itself accepts `/^[a-z][a-z0-9_-]*$/`:

    ```go
    package demo

    import (
      shimast "github.com/microsoft/typescript-go/shim/ast"
      "github.com/samchon/ttsc/packages/lint/rule"
    )

    func init() { rule.Register(noTodoComment{}) }

    type noTodoComment struct{}

    func (noTodoComment) Name() string             { return "demo/no-todo-comment" }
    func (noTodoComment) Visits() []shimast.Kind   { return []shimast.Kind{shimast.KindSourceFile} }
    func (noTodoComment) Check(ctx *rule.Context, node *shimast.Node) {
      // ctx.File, ctx.Checker, ctx.Severity available
      // ctx.Report(node, msg) or ctx.ReportRange(pos, end, msg)
    }
    ```

3. **User registration** — either inline in tsconfig (`plugins: { demo: "ttsc-lint-plugin-demo" }`) or as an ESLint-flat-config plugin object inside `lint.config.ts`:

    ```ts
    import demoPlugin from "ttsc-lint-plugin-demo";
    import { defineConfig } from "@ttsc/lint";

    export default defineConfig([
      {
        plugins: { demo: demoPlugin },
        rules: { "demo/no-todo-comment": "error" },
      },
    ]);
    ```

What to learn:

- Public rule registration without entering `package main`.
- AST surface symmetry — contributor rules use the same `shim/ast` / `shim/checker` / `shim/scanner` packages first-party plugins consume.
- Build-time source merging through ttsc's plugin builder, with the cache key including each contributor's source hash.
- Two discovery surfaces in `@ttsc/lint`'s JS factory: inline `plugins` map on the tsconfig entry, and flat-config `plugins` field inside a `lint.config.ts` / `eslint.config.ts` (evaluated through ttsx).

Read:

- [`packages/lint/rule/rule.go`](../packages/lint/rule/rule.go) — the public Go surface (Rule, Context, Severity, Register).
- [`packages/lint/plugin/contrib_adapter.go`](../packages/lint/plugin/contrib_adapter.go) — host-side adapter that wraps `rule.Rule` into the engine's internal `Rule`.
- [`tests/lint-contributor-demo`](../tests/lint-contributor-demo/) — the canonical reference contributor used by the e2e tests.
- [`tests/test-lint/src/features/contributor`](../tests/test-lint/src/features/contributor/) — end-to-end coverage for both discovery surfaces.

### Emitting Autofixes

A contributor rule can attach source-text edits to a finding by calling `ctx.ReportFix` (single edit) or `ctx.ReportRangeFix` (explicit pos/end). The host applies edits between the cascading native passes and the final no-emit check; if the host build did not opt into fix mode the edits are silently dropped and only the diagnostic is rendered — see `rule.ReportFix` GoDoc for the silent-fallback contract. Do not rely on edits being applied; design the rule so the diagnostic alone is useful.

```go
package demo

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"

  "github.com/samchon/ttsc/packages/lint/rule"
)

func init() { rule.Register(noTodoComment{}) }

type noTodoComment struct{}

func (noTodoComment) Name() string           { return "demo/no-todo-comment" }
func (noTodoComment) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noTodoComment) Check(ctx *rule.Context, node *shimast.Node) {
  // Resolve pos/end from a shim/scanner trivia walk over ctx.File.Text();
  // see tests/lint-contributor-demo/rules/no_todo_comment.go for the runnable form.
  ctx.ReportFix(node, "drop TODO comment", rule.TextEdit{
    Pos:  pos,
    End:  end,
    Text: "",
  })
}
```

See [`tests/lint-contributor-demo/rules/no_todo_comment.go`](../tests/lint-contributor-demo/rules/no_todo_comment.go) for the original diagnostic-only contributor and [`tests/lint-contributor-demo/rules/capitalize_exports.go`](../tests/lint-contributor-demo/rules/capitalize_exports.go) for the first contributor that emits a real `ReportRangeFix` covered end-to-end by [`tests/test-lint/src/features/fix/test_lint_fix_contributor_rule_single_edit_applies_through_native_engine.ts`](../tests/test-lint/src/features/fix/test_lint_fix_contributor_rule_single_edit_applies_through_native_engine.ts).

Within a single fix pass, edits must not overlap; ordering inside the slice does not matter, and an empty `Text` deletes the range. When two edits in the same pass cover overlapping ranges (within one finding or across two rules), the host keeps the earliest-starting / shortest edit and silently drops the rest — there is no diagnostic for dropped edits today. Prefer one contiguous edit per finding over speculative multi-edit batches; `no-import-type-side-effects` is the canonical multi-edit example because the inserts and per-specifier deletes are guaranteed non-overlapping.

#### `rule/astutil` — byte-oriented helpers for contributor fixers

The `github.com/samchon/ttsc/packages/lint/rule/astutil` package exposes the same byte-range helpers that `@ttsc/lint`'s built-in rules use:

- `NodeText(file, node)` — node source with leading trivia stripped, for splicing into a replacement string.
- `KeywordStart(file, node, "var")` — offset of the leading keyword token of a node, anchoring the keyword-swap shape.
- `FindKeyword(file, pos, end, "import")` — identifier-aware keyword scan over an arbitrary byte range; matches do not cross identifier boundaries (`import` ≠ the `import` prefix of `importMap`). Note: the scan is byte-only and not comment-aware; for contributor fixers that need to locate a token inside a node, prefer combining `shim/scanner`'s `SkipTrivia` with a manual `byte` check, the way `no-import-type-side-effects` does.
- `TokenRange(file, node)` — `[pos, end)` with leading trivia skipped, for "replace the whole node" edits.

The API is intentionally narrow in round 1 / round 2 — `IdentifierText`, `StripParens`, `HasModifier`, and a function-like body walker are the most likely next additions; in the meantime contributor rules can implement them inline.

#### `rule.FixReporter` — host-side reporter shape

The host's fix-aware reporter implements `rule.FixReporter`, which the public `Context.ReportFix` / `ReportRangeFix` discover via a type assertion. **Contributor rules do not implement this interface.** When unit-testing a contributor rule with a fake `rule.Reporter`, declare `var _ rule.FixReporter = &myReporter{}` in the test to compile-check that the fake supports the fix path; Go interface satisfaction is all-or-nothing, so a fake that implements only `ReportFix` and not `ReportRangeFix` will silently fall through to the legacy `Report` path.

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

Pinned by: `ttsc first-party plugins: lint, banner, paths, and strip run together in ttsc build` in [`tests/test-ttsc/src/features/first-party-plugins/test_ttsc_first_party_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build.ts`](../tests/test-ttsc/src/features/first-party-plugins/test_ttsc_first_party_plugins_lint_banner_paths_and_strip_run_together_in_ttsc_build.ts).
