# Plugin Protocol Reference

This page is the authoritative reference for the two contract surfaces a `ttsc` plugin must implement:

1. The **JS manifest** — what `ttsc` reads from the consumer's `compilerOptions.plugins`.
2. The **CLI protocol** — what the compiled Go binary must accept on the command line.

If you just want a working example, see [getting-started.md](./01-getting-started.md). This page is for filling gaps and resolving ambiguity.

## Manifest

The manifest module exports either:

- a plain object satisfying `TtscPlugin`, or
- a factory function `(config, context) => TtscPlugin`, exported as `default`, named `createTtscPlugin`, or as the module's default `module.exports`.

When the consumer's `tsconfig.json` declares plugin entries with extra fields, the factory form receives them as `config`:

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "my-plugin", "name": "primary", "mode": "uppercase", "prefix": "A:" }
    ]
  }
}
```

```js
module.exports = (config, context) => ({
  name: config.name,
  native: {
    mode: config.mode,
    source: { dir: require("node:path").resolve(__dirname, "go-plugin") },
    contractVersion: 1,
  },
});
```

`context` provides `{ binary, cwd, projectRoot, tsconfig }`. The full set of arbitrary `config` fields (everything beyond `transform` and `enabled`) is later forwarded to your binary via `--plugins-json`.

### `TtscPlugin` shape

```ts
interface TtscPlugin {
  name: string;
  native?: TtscNativeBackend;
}

interface TtscNativeBackend {
  mode: string;
  source?: TtscNativeSource;     // build-from-source path (recommended)
  binary?: string;                // pre-built binary path (legacy / advanced)
  contractVersion?: 1;
  capabilities?: readonly string[];
}

interface TtscNativeSource {
  dir: string;                    // absolute path to a Go module directory
  entry?: string;                 // Go package path within `dir`. Default ".".
}
```

### Field semantics

- **`name`** — used in error messages and to identify the plugin in ordered pipelines. Must be a non-empty string.
- **`native.mode`** — opaque string your binary uses to dispatch. Two plugin entries declaring the *same* `source.dir` but different `mode` values share one compiled binary; the binary sees both modes through `--plugins-json` ordering.
- **`native.source.dir`** — absolute filesystem path to a Go module (a directory containing `go.mod`). Use `path.resolve(__dirname, "go-plugin")` for portability across `node_modules` layouts.
- **`native.source.entry`** — Go package path inside `dir` to build, in the form `go build` accepts (e.g. `"./cmd/transformer"`). Default is `"."`. Use this when your repo has multiple `main` packages or shared internal packages.
- **`native.binary`** — for users who pre-build their binary out-of-band (e.g. CI artifact), an absolute path to it. **Mutually exclusive with `native.source`.** This path is the legacy lane preserved for compatibility; new plugins should use `source`.
- **`native.contractVersion`** — protocol version your binary speaks. Must be `1` today. Future major-protocol changes will bump this; `ttsc` refuses to load mismatched contract versions.
- **`native.capabilities`** — capability strings used by the host to place the plugin in the pipeline. Omit it, or use `["transform"]`/`["build"]`, for a compiler backend that owns emit. Use `["check"]` for diagnostics-only plugins that run before emit. Use `["output"]` for post-emit plugins that receive emitted files through the `output` command.

### Validation

`ttsc` rejects manifests at config-parse time when:

- Both `native.binary` and `native.source` are present.
- `native.source.dir` is empty or missing.
- `native.source.dir` does not exist on disk.
- `native.contractVersion` is anything other than `1`.

Errors are surfaced before any Go build runs.

### Disabling individual entries — `enabled: false`

Each `compilerOptions.plugins[]` entry accepts an `enabled` flag. When `enabled` is explicitly `false`, `ttsc` filters that entry out before plugin loading — manifest is not required, the source is not built, the entry is not passed in `--plugins-json`. Useful for conditional or environment-specific pipelines:

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "ttsc-plugin-prefix", "prefix": "[dev] ", "enabled": false },
      { "transform": "ttsc-plugin-uppercase" }
    ]
  }
}
```

`enabled` is the only `ttsc`-level field on a plugin entry besides `transform`. Anything else (`name`, `mode`, your custom keys) flows through to your binary verbatim via `--plugins-json`. Omitting `enabled` (or setting it to `true`) keeps the entry active.

## CLI protocol

`ttsc` invokes your compiled binary through subcommands. Three are **required** (`check`, `transform`, `build`); `version` is **optional** (recommended for future compatibility diagnostics, ignored today). An unknown subcommand should exit non-zero with a clear stderr message.

### `version` (optional — also `-v`, `--version`)

```
my-plugin version
```

Prints any human-readable version banner to stdout and exits `0`. `ttsc` doesn't probe this today; future releases may use it for compatibility diagnostics. Implementing it costs four lines and saves you a future migration — recommend, but not required.

### `check`

```
my-plugin check \
  --cwd=<absolute-project-root> \
  --tsconfig=<absolute-tsconfig-path> \
  --rewrite-mode=<mode-string> \
  --plugins-json=<json>
```

Analysis-only entry. Run any validation logic; do not emit files. Exit `0` on success, non-zero on diagnostics. `ttsc` invokes this when the consumer runs with `--noEmit` (CI gates).

### `transform`

```
my-plugin transform \
  --file=<absolute-source-file-path> \
  --tsconfig=<absolute-tsconfig-path> \
  --rewrite-mode=<mode-string> \
  --plugins-json=<json> \
  [--out=<absolute-output-path>]
```

Single-file transform — used by bundler hooks (vite, webpack, esbuild, …) and `ttsc transform --file=...`. Read the file at `--file`, produce the transformed JavaScript text. Write it to `--out` if given, otherwise to stdout.

### `build`

```
my-plugin build \
  --cwd=<absolute-project-root> \
  --tsconfig=<absolute-tsconfig-path> \
  --rewrite-mode=<mode-string> \
  --plugins-json=<json> \
  [--emit | --noEmit] \
  [--outDir=<absolute-output-dir>] \
  [--quiet | --verbose]
```

Project-wide build. Walk the project, transform every relevant source file, write outputs under `--outDir` (default: tsconfig's `outDir` resolved against `--cwd`).

### Common flag semantics

- All path flags are **absolute** when `ttsc` invokes them. Don't assume `--cwd` matches `process.cwd()`.
- Unknown flags should be tolerated silently — `ttsc` may add new optional flags in minor versions. Go's standard `flag` parser does **not** do this by itself; if your binary uses it, filter unknown flags before parsing or wrap it with a permissive parser.
- Exit codes: `0` success, `2` for argument/usage errors, anything else for runtime errors. `ttsc` surfaces stderr verbatim to the user.

### `--rewrite-mode`

This is the `mode` of the **first** entry in `--plugins-json` (or `"none"` when no plugins are active). It exists because the legacy native-binary lane needed a single-value mode dispatch flag before ordered pipelines were a thing. New plugins should ignore it for dispatch — read `--plugins-json` instead, which carries the full ordered list with per-entry modes. The flag is preserved for compatibility and may be deprecated in a later version.

### `capabilities` (manifest field)

Reserved for future protocol negotiation. Today it's pure metadata — `ttsc` does not branch on it and your plugin should not rely on `ttsc` filtering by capability strings. Set it to `["transform"]` if you want self-documentation; leave it omitted otherwise. Don't invent capability strings consumers might depend on — they have no enforcement path.

### `--plugins-json` payload

This is a JSON-encoded array of descriptors, one per *enabled* plugin entry in the consumer's tsconfig (already filtered to plugins backing the same binary, in source order):

```json
[
  {
    "name": "primary",
    "mode": "uppercase",
    "config": {
      "transform": "my-plugin",
      "name": "primary",
      "mode": "uppercase",
      "prefix": "A:"
    },
    "contractVersion": 1
  },
  {
    "name": "secondary",
    "mode": "suffix",
    "config": { "transform": "my-plugin", "name": "secondary", "mode": "suffix", "suffix": ":Z" },
    "contractVersion": 1
  }
]
```

The `config` field is the **complete plugin entry from tsconfig.json**, including the user's arbitrary fields. A plugin reading `prefix` or `suffix` from `config` is how you accept user options.

### Ordered pipelines

When the consumer declares multiple tsconfig plugin entries that all resolve to the same `source.dir`, `ttsc` builds **one** binary and invokes it once per `transform`/`build` call with the relevant ordered list in `--plugins-json`. Your binary is responsible for applying those descriptors in array order:

```go
for _, plugin := range pluginsFromJSON {
    switch plugin.Mode {
    case "uppercase": value = strings.ToUpper(value)
    case "prefix":    value = stringConfig(plugin.Config, "prefix") + value
    case "suffix":    value += stringConfig(plugin.Config, "suffix")
    }
}
```

Different `["output"]` plugins may point at different `source.dir` values. `ttsc` emits the project first, then invokes each output plugin's binary in `compilerOptions.plugins` order once per emitted file:

```go
switch os.Args[1] {
case "output":
    // read --file, apply this plugin's config from --plugins-json,
    // then rewrite --file or write --out
}
```

Check-only plugins run before emit. Compiler-backend plugins still own their emit pass; multiple compiler backends must share one binary if they are meant to cooperate inside the same compiler pass.

### What `ttsc` does to the binary's stdout/stderr

- `transform`: stdout is captured *only* when `--out` is omitted. With `--out=path`, stdout is ignored and `--out` content is the transformed JS.
- `build`: stdout/stderr passed through to the user. Non-zero exit fails the project build.
- `check`: stdout typically empty; stderr is where you write diagnostics.

## Versioning and compatibility

The protocol version (`contractVersion: 1`) is the contract between `ttsc` and your binary. Within v1:

- `ttsc` may add **new optional flags** to existing subcommands. Plugin binaries must ignore unknown flags rather than failing argument parsing.
- `ttsc` may add **new fields** to `--plugins-json` descriptors. Plugin binaries must ignore unknown JSON fields (which Go's `encoding/json` does by default).
- `ttsc` will **not** rename or remove existing flags or descriptor fields without bumping `contractVersion`.

If `ttsc` ever introduces v2, plugins declaring `contractVersion: 1` will continue to be invoked through v1 emulation for at least one minor release.
