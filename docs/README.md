# ttsc Plugin Author Guide

This guide is for developers writing `ttsc` plugins: npm packages that expose a JavaScript manifest and a Go native backend. The backend can run as a compiler backend, a diagnostics pass, or a post-emit output pass.

`ttsc` is a general TypeScript-Go compiler/runtime/plugin host. These docs describe the public plugin contract for general TypeScript projects, not a consumer-specific adapter.

> Status: v1, still moving. Pin a tested `ttsc` minor in your plugin's `peerDependencies` until the protocol stabilizes.

## How ttsc Works

`ttsc` is a JavaScript host around the TypeScript-Go compiler. TypeScript-Go still parses, checks, and emits the project. `ttsc` adds the plugin layer around that compiler run.

For a normal build with plugins:

1. `ttsc` reads the consumer's `tsconfig.json`.
2. It resolves every active `compilerOptions.plugins[]` entry.
3. Each plugin's JavaScript manifest returns a native backend descriptor.
4. If the descriptor uses `native.source`, `ttsc` builds that Go source with the `ttsc`-pinned TypeScript-Go shims.
5. The built binary is cached under the project cache.
6. `ttsc` routes execution by capability:
   - `["check"]` runs before emit for diagnostics;
   - compiler backends run `check`, `transform`, or `build` and own emit;
   - `["output"]` plugins run after TypeScript-Go emits files.
7. The binary receives project/plugin data through CLI flags, especially `--plugins-json`.

The important boundary: the JavaScript manifest selects and configures the backend; the Go binary does the real plugin work.

## What You Build

A plugin package usually contains:

```text
my-plugin/
|- package.json
|- plugin.cjs
|- go-plugin/
|  |- go.mod
|  `- main.go
`- README.md
```

The manifest tells `ttsc` where the Go source lives:

```js
const path = require("node:path");

module.exports = {
  name: "my-plugin",
  native: {
    mode: "my-plugin",
    source: { dir: path.resolve(__dirname, "go-plugin") },
    contractVersion: 1,
  },
};
```

When a consumer runs `ttsc`, the host reads this manifest, builds the Go source with `ttsc`'s pinned TypeScript-Go shims, caches the binary, and invokes it with the plugin protocol.

## Plugin Kinds

Pick the smallest kind that fits the job:

| Kind | Manifest capability | Use it for | Reference |
| --- | --- | --- | --- |
| Output plugin | `["output"]` | Edit emitted `.js` / `.d.ts` files after TypeScript-Go emits | `@ttsc/banner`, `@ttsc/strip`, `@ttsc/paths` |
| Check plugin | `["check"]` | Add diagnostics before emit | `@ttsc/lint` |
| Compiler backend | omitted / `["transform"]` / `["build"]` | Own Program creation and emit | semantic codegen plugins |

Most plugin authors should start with an output plugin. Move to Program/Checker work only when the emitted file alone is not enough.

A project can list several `compilerOptions.plugins[]` entries. Check plugins compose with compiler backends. Output plugins compose with TypeScript-Go's normal emit path and with other output plugins.

The one exclusive role is the compiler backend. A build can have only one distinct native binary that owns Program creation and emit. If several compiler-backend modes need to cooperate, expose them from one native binary and dispatch by the ordered `--plugins-json` payload.

## Reading Order

1. [Getting Started](./01-getting-started.md) - build the smallest useful output plugin.
2. [Protocol](./02-protocol.md) - manifest fields and binary subcommands.
3. [Reference Plugins](./10-reference-plugins.md) - guided tour of `banner`, `strip`, `paths`, and `lint`, ordered by difficulty.
4. [Recipes](./08-recipes.md) - focused patterns you can copy.
5. [AST and Checker](./03-tsgo.md) - TypeScript-Go AST traversal, text ranges, Program bootstrap, and Checker usage.
6. [Local Development](./04-local-dev.md) - `go.work`, gopls, `go test`, and pnpm notes.
7. [Internals](./05-internals.md) - build cache and toolchain resolution.
8. [Testing](./07-testing.md) - Go unit tests and end-to-end `ttsc` fixtures.
9. [Publishing](./06-publishing.md) - npm package shape and pre-publish checks.
10. [Pitfalls](./09-pitfalls.md) - common first-hour failures.

## Repository References

Use these when reading real code:

- [`packages/banner`](../packages/banner/) - smallest output plugin.
- [`packages/strip`](../packages/strip/) - output plugin with JS AST parsing and text edits.
- [`packages/paths`](../packages/paths/) - output plugin with tsconfig parsing and Program-backed path resolution.
- [`packages/lint`](../packages/lint/) - diagnostics plugin with Program/Checker access.
- [`tests/projects/go-source-plugin-checker`](../tests/projects/go-source-plugin-checker/) - minimal Program/Checker bootstrap fixture.
- [`tests/projects/go-source-plugin-properties`](../tests/projects/go-source-plugin-properties/) - AST traversal fixture.

## Requirements

- Node.js >= 18.
- `ttsc` installed in the consumer project.
- `@typescript/native-preview` installed in the consumer project.
- No system Go installation is required for consumers; `ttsc` uses its bundled Go toolchain. Plugin authors may install Go locally for direct `go test` / `go vet`.
