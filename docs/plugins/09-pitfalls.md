# First-Contact Pitfalls

Top failures plugin authors hit in the first hour. Read this once, save the corresponding hour.

## 1. `native.source.dir does not exist`

You published your plugin and the consumer hits this on first install.

**Cause.** The Go source directory wasn't included in your npm tarball. By default npm publishes a curated set of files; your plugin's `go-plugin/` directory needs to be explicitly listed.

**Fix.** In `package.json`:

```json
"files": [
  "plugin.cjs",
  "go-plugin"
]
```

Run `npm pack --dry-run` before publishing to verify the tarball includes `go-plugin/main.go`, `go-plugin/go.mod`, etc. See [06-publishing.md](./06-publishing.md#files-is-the-most-common-mistake).

## 2. `native.source.dir does not exist` (path resolution variant)

Same error, different cause. Your `plugin.cjs` uses a relative path that breaks once the package is installed under `node_modules/`.

**Cause.**

```js
// WRONG — resolves against process.cwd(), not the plugin's own location
source: { dir: "./go-plugin" }
```

**Fix.**

```js
// RIGHT — resolves against the .cjs file's own directory
source: { dir: path.resolve(__dirname, "go-plugin") }
```

`__dirname` is the directory of the `.cjs` file at runtime, regardless of where it's installed. Always use it.

## 3. `no required module provides package github.com/microsoft/typescript-go/shim/X`

You imported a tsgo shim and forgot to add a `require` line.

**Fix.** In your plugin's `go.mod`:

```
require github.com/microsoft/typescript-go/shim/X v0.0.0
```

The `v0.0.0` is a placeholder; `ttsc`'s `go.work` overlay supplies real resolution at build time. Required for *every* shim package you import. See [03-tsgo.md](./03-tsgo.md#how-to-use-a-shim--the-current-rules) for the full rule.

## 4. gopls highlights tsgo imports as unresolved

You added the `require`, the build works under `ttsc`, but your editor shows red squiggles on every shim import. Autocomplete on `shimcore.` doesn't work.

**Cause.** Your editor's gopls runs in your repo's own context and looks for a workspace at the repo root. Without one, it can't resolve `shim/X` to the actual local source under `node_modules/ttsc/`.

**Fix.** Set up `go.work` at your repo root pointing at `./node_modules/ttsc/...`. See [04-local-dev.md](./04-local-dev.md) for the full template. After saving `go.work`, restart gopls (in VS Code: `> Go: Restart Language Server`).

## 5. pnpm: `go.work` use directives can't find `ttsc`

You followed [04-local-dev.md](./04-local-dev.md) but `go build` fails with "directory ./node_modules/ttsc does not exist".

**Cause.** pnpm's default `node-linker=isolated` puts dependencies under `node_modules/.pnpm/<pkg>@<ver>/node_modules/<pkg>/`, not the flat `node_modules/<pkg>/` layout. Your `go.work` paths don't resolve.

**Fix.** Easiest: add `node-linker=hoisted` to your plugin repo's `.npmrc`:

```ini
# .npmrc
node-linker=hoisted
```

Reinstall (`pnpm install`). Now `node_modules/ttsc/` exists at the top level. Your published plugin still works for any consumer regardless of their package manager — this only changes *your* dev setup.

Alternatives discussed in [04-local-dev.md](./04-local-dev.md#step-by-step) under the pnpm note.

## 6. `--plugins-json` not parsed → modes ignored

Your plugin works for one tsconfig entry but ignores config when the consumer adds multiple modes.

**Cause.** Your binary's `transform`/`build` subcommand declares a `--plugins-json` flag but doesn't actually use it.

**Fix.** Parse the flag and dispatch by `mode` in array order. Minimum useful skeleton:

```go
type Plugin struct {
    Config map[string]any `json:"config"`
    Mode   string         `json:"mode"`
}

pluginsJSON := fs.String("plugins-json", "", "")
// ... after fs.Parse ...
var plugins []Plugin
if *pluginsJSON != "" {
    if err := json.Unmarshal([]byte(*pluginsJSON), &plugins); err != nil {
        // handle
    }
}
for _, p := range plugins {
    // dispatch by p.Mode, read p.Config
}
```

See [08-recipes.md](./08-recipes.md#multi-mode-dispatch) for the full pattern.

## 7. "ordered native plugin pipeline requires a single native host binary"

The consumer wired two different plugins (`plugin-a`, `plugin-b`) and `ttsc` rejects the build at config-parse time.

**Cause.** Each plugin compiles to a separate binary. `ttsc`'s contract is one binary per project compile; mixing two plugins produces two binaries with no way to merge them.

**Fix.** This is a constraint the consumer has to resolve, not the plugin author. The consumer either picks one plugin or finds a "meta-plugin" that subsumes both. Plugin authors writing in this space sometimes ship a single binary that registers multiple modes (see [08-recipes.md](./08-recipes.md#multi-mode-dispatch)) so consumers can mix capabilities without mixing binaries.

## 8. Plugin builds locally, fails on Windows CI

Cross-platform issue. Common variants:

**Path separator.** `filepath.ToSlash(p)` before string-comparing paths from `program.SourceFiles()` and your `--file` argument.

**Binary name.** On Windows the cached binary is `plugin.exe`. `ttsc` handles this transparently; don't hard-code `plugin` (no `.exe`) anywhere in your own integration tests.

**Line endings.** If your transform asserts on regex matches against source text, account for `\r\n` line endings. `(?m)` mode in Go's regexp doesn't strip `\r`; use `\r?\n` or normalize first.

## 9. Transform output looks right, but consumer's runtime errors

Your `dist/main.js` *looks* correct, but `node dist/main.js` throws `ReferenceError: foo is not defined` or similar.

**Cause.** Your transform omitted a CommonJS boilerplate line that the consumer's other emitted JS expects. The most common culprits:

- Missing `"use strict";` at the top.
- Missing `Object.defineProperty(exports, "__esModule", { value: true });`.
- Missing `exports.X = void 0;` declarations before assignments.

**Fix.** Mirror what `tsc`/`tsgo` itself emits for a CommonJS module. The fixture in [`tests/projects/go-source-plugin/go-plugin/main.go`](../../tests/projects/go-source-plugin/go-plugin/main.go) shows the minimum boilerplate.

## 10. Cache hits when you expected a rebuild

You edited a file in `go-plugin/` and re-ran `ttsc`, but stderr doesn't show the rebuild log.

**Cause.** The file you edited is excluded from the cache hash. `ttsc` only hashes files matching `*.go`, `*.s`, `*.c`, `*.h`, `*.cpp`, `*.hpp`, `go.mod`, `go.sum`, `go.work`. Editing a `README.md` or a `data.json` your plugin reads at runtime does not invalidate the cache.

**Fix.** If your plugin needs to read a runtime data file, embed it via `//go:embed` so it's part of the binary. The compiled binary is cache-key-invalidated on Go source change, so the embedded data updates with it.

If you really need cache invalidation on a non-source file, run `npx ttsc clean`, or set `TTSC_CACHE_DIR` to a fresh dir for the run.

---

If you hit one not on this list and it took you longer than 30 minutes to figure out, that's evidence to add it here. Open an issue or PR.
