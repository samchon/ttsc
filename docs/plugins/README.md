# ttsc Plugin Author Guide

This guide is for people writing transformer plugins on top of `ttsc` — Go programs that `ttsc` compiles locally on each consumer's machine and runs as part of the TypeScript compilation pipeline.

> **Status: v1, in flux.** The CLI protocol fields and JS manifest shape may still change before stabilization. Pin a specific `ttsc` minor version in your plugin's `peerDependencies` until v1.0.

## A 30-second preview

Your consumer writes ordinary TypeScript with a hook your plugin recognizes — for example, a call to `goUpper("hello")`:

```ts
// src/main.ts (consumer)
export const value: string = goUpper("hello");
console.log(value);
```

You publish a tiny npm package with two files: a JS manifest and a Go source file.

```js
// plugin.cjs
const path = require("node:path");
module.exports = {
  name: "my-plugin",
  native: {
    mode: "uppercase",
    source: { dir: path.resolve(__dirname, "go-plugin") },
    contractVersion: 1,
  },
};
```

```go
// go-plugin/main.go (excerpt — full version in 01-getting-started.md)
func transform(source string) (string, error) {
    match := goUpperCall.FindStringSubmatch(source)
    name, value := match[1], strings.ToUpper(match[2])
    return fmt.Sprintf(`const %s = %q; exports.%s = %s;`, name, value, name, name), nil
}
```

The consumer runs `npx ttsc --emit`. `ttsc` reads your manifest, compiles your Go source against its own pinned `typescript-go` (cached afterwards), and runs the resulting binary against each `.ts` file:

```js
// dist/main.js (after transform)
const value = "HELLO";
exports.value = value;
console.log(value);
```

That's the whole loop. Read on for the mental model and the contracts that hold this together.

## Mental model

A `ttsc` plugin has two halves living inside one npm package:

1. **JS manifest** — a `.cjs` (or `.js`) file referenced from the user's `compilerOptions.plugins`. It declares your plugin's name and how it should be backed at runtime: which Go source directory to build, what mode the user-facing transform expects, what protocol version you speak.
2. **Go source** — a real Go module shipped *inside the npm package*. `ttsc` compiles it locally on the user's machine into a CLI binary that speaks `ttsc`'s plugin protocol.

When a project's `tsconfig.json` references your plugin, `ttsc`:

1. Reads your manifest.
2. Hashes your Go source (plus `ttsc` version, `tsgo` version, platform/arch, entry).
3. On cache hit (`~/.cache/ttsc/plugins/<hash>/plugin`), loads the existing binary.
4. On cache miss, compiles your Go source against `ttsc`'s pinned `typescript-go` shim and caches the result.
5. Spawns the binary against the user's `tsconfig` and source files, passing your config through `--plugins-json`.

You publish the npm package once. End users do *not* need a precompiled binary in your tarball — `ttsc` builds it for them at first invocation.

## Why Go source instead of a precompiled binary?

A precompiled binary plugin has to match three independent versions exactly: `ttsc`'s pinned `typescript-go`, `ttsc` itself, and the plugin. A skew between any two breaks consumers silently at *load* time.

Go interfaces are structural. When `ttsc` rebuilds your plugin source against its own pinned shim, your plugin only has to satisfy the parts of the API it actually touches. Unrelated additions or renames elsewhere in `typescript-go` are invisible to your plugin. Real semantic breaks (a method *you call* is renamed) still fail — but they fail at *build time* with a clear Go compile error, not silently at load time. The failure surface moves from "ABI-mismatch hell" into a debuggable region.

This is the same model `xcaddy` uses for Caddy modules.

## What's in this guide

Read in order:

1. [01-getting-started.md](./01-getting-started.md) — copy-paste a working plugin in ~10 minutes.
2. [02-protocol.md](./02-protocol.md) — full reference for the JS manifest and the CLI protocol your compiled binary must implement.
3. [03-tsgo.md](./03-tsgo.md) — importing `typescript-go` AST / Checker / Scanner from your plugin, including the bootstrap pattern for typia-class semantic plugins.
4. [04-local-dev.md](./04-local-dev.md) — set up `go.work` so gopls / `go build` / `go test` all work standalone in your dev loop. (Only needed if your plugin imports tsgo shims.)
5. [05-internals.md](./05-internals.md) — how `ttsc` builds and caches your plugin (debugging aid).
6. [06-publishing.md](./06-publishing.md) — npm publish workflow, `peerDependencies` policy, the `files` field gotcha.
7. [07-testing.md](./07-testing.md) — Go unit tests for transform logic, integration tests via `ttsc` against fixtures.
8. [08-recipes.md](./08-recipes.md) — common patterns: multi-mode dispatch, `--plugins-json` config, diagnostics, watch mode, source maps.
9. [09-pitfalls.md](./09-pitfalls.md) — first-contact mistakes and their fixes. Skim once, save an hour.

## Concrete reference plugins (in this repo)

These are the fixtures `ttsc`'s own test suite uses. They're the most authoritative working examples until a published plugin SDK exists:

- [`tests/projects/go-source-plugin/`](../../tests/projects/go-source-plugin/) — a 5-mode transformer (uppercase / lowercase / prefix / suffix / reverse) that parses `--plugins-json` and dispatches by mode. Exercise the most surfaces.
- [`tests/projects/go-source-plugin-entry/`](../../tests/projects/go-source-plugin-entry/) — same shape but with the build entry under `cmd/transformer/` to demonstrate `native.source.entry`.
- [`tests/projects/go-source-plugin-tsgo/`](../../tests/projects/go-source-plugin-tsgo/) — imports `github.com/microsoft/typescript-go/shim/core` to prove the go.work overlay actually wires `ttsc`'s pinned shim into the plugin build.
- [`tests/projects/go-source-plugin-checker/`](../../tests/projects/go-source-plugin-checker/) — bootstraps a real `Program` and `Checker` from the consumer's tsconfig and locates the target source file. See [03-tsgo.md](./03-tsgo.md#bootstrapping-a-program-and-a-checker).
- [`tests/projects/go-source-plugin-properties/`](../../tests/projects/go-source-plugin-properties/) — walks every program source file's AST, finds each `InterfaceDeclaration`, and emits its property names as a JSON array literal. The reference for typia-class semantic plugins; see [03-tsgo.md](./03-tsgo.md#walking-the-ast).

## Requirements (current)

- Node.js ≥ 18 (consumer side)
- Go ≥ 1.26 on the consumer's PATH, or the consumer sets `TTSC_GO_BINARY` to an absolute path
- The consumer project has `@typescript/native-preview` installed (this is the standard `tsgo` package)

> **Roadmap:** the Go toolchain dependency will be replaced by `ttsc-go-<platform>` npm subpackages bundled under `optionalDependencies` so casual JS users don't need a system Go install. See [05-internals.md](./05-internals.md#go-toolchain).
