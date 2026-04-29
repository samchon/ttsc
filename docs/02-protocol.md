# Plugin Protocol Reference

This page is the contract between `ttsc` and a plugin package.

## Manifest

The plugin entry in `tsconfig.json` points at a JavaScript module:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "my-plugin", "mode": "strict", "enabled": true }
    ]
  }
}
```

The module exports either a plugin object or a factory:

```js
const path = require("node:path");

module.exports = (config, context) => ({
  name: "my-plugin",
  native: {
    mode: String(config.mode ?? "default"),
    source: { dir: path.resolve(__dirname, "go-plugin") },
    contractVersion: 1,
    capabilities: ["output"],
  },
});
```

`context` contains:

```ts
{
  binary: string;
  cwd: string;
  projectRoot: string;
  tsconfig: string;
}
```

### Shape

```ts
interface TtscPlugin {
  name: string;
  native?: TtscNativeBackend;
}

interface TtscNativeBackend {
  mode: string;
  source?: { dir: string; entry?: string };
  binary?: string;
  contractVersion?: 1;
  capabilities?: readonly string[];
}
```

Field rules:

- `name`: non-empty display name.
- `native.mode`: stable dispatch string. Prefer a package-scoped value such as `acme.schema`.
- `native.source.dir`: absolute path to a Go module containing `go.mod`.
- `native.source.entry`: package path passed to `go build`; default is `"."`.
- `native.binary`: absolute prebuilt binary path. Advanced/legacy only.
- `native.contractVersion`: currently `1`.
- `native.capabilities`: pipeline placement.

`native.source` and `native.binary` are mutually exclusive.

## Capabilities

| Capability | Host behavior | Binary commands |
| --- | --- | --- |
| omitted / `["transform"]` / `["build"]` | plugin owns compiler backend and emit | `check`, `transform`, `build` |
| `["check"]` | plugin runs diagnostics before emit | `check` |
| `["output"]` | plugin runs after emit, once per emitted file, in plugin order | `output` |

Use only these capability strings. Unknown strings are not a public extension point.

Projects can enable multiple plugin entries. `["check"]` entries run before emit and can be combined with a compiler backend. `["output"]` entries run after TypeScript-Go's normal emit path in tsconfig plugin order.

The compiler backend role is exclusive. A build cannot chain two separate binaries that both own Program creation and emit. To compose several compiler-backend modes, make them resolve to the same native binary and dispatch inside that binary by the ordered `--plugins-json` payload.

## Disabled Entries

`enabled: false` disables a plugin entry before loading:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "my-plugin", "enabled": false },
      { "transform": "other-plugin" }
    ]
  }
}
```

Disabled entries are not resolved, built, or included in `--plugins-json`.

## CLI Commands

The binary receives subcommands. Unknown flags should be ignored so future `ttsc` minors can add optional flags.

### `version`

```bash
my-plugin version
my-plugin -v
my-plugin --version
```

Print a human-readable version and exit `0`.

### `check`

```bash
my-plugin check \
  --cwd=/project \
  --tsconfig=/project/tsconfig.json \
  --rewrite-mode=my-plugin \
  --plugins-json='[...]'
```

Run diagnostics only. Write diagnostics to stderr. Exit non-zero for errors.

### `transform`

```bash
my-plugin transform \
  --file=/project/src/main.ts \
  --out=/tmp/main.js \
  --tsconfig=/project/tsconfig.json \
  --rewrite-mode=my-plugin \
  --plugins-json='[...]'
```

Single-source-file transform used by `ttsc transform` and bundler-style callers. Write JS to `--out` when provided, otherwise stdout.

### `build`

```bash
my-plugin build \
  --cwd=/project \
  --tsconfig=/project/tsconfig.json \
  --rewrite-mode=my-plugin \
  --plugins-json='[...]' \
  --emit \
  --outDir=/project/dist
```

Project-wide compiler backend. Run diagnostics and write outputs.

### `output`

```bash
my-plugin output \
  --file=/project/dist/main.js \
  --cwd=/project \
  --tsconfig=/project/tsconfig.json \
  --rewrite-mode=my-plugin \
  --plugins-json='[...]'
```

Post-emit edit. Read `--file`, rewrite it in place, or write `--out` if the host supplies one.

## `--plugins-json`

`--plugins-json` is an ordered JSON array of plugin descriptors for the current command:

```json
[
  {
    "name": "my-plugin",
    "mode": "prefix",
    "contractVersion": 1,
    "config": {
      "transform": "my-plugin",
      "mode": "prefix",
      "prefix": "A:"
    }
  }
]
```

`config` is the original tsconfig plugin entry. Read your user options there.

When multiple entries resolve to the same binary, `ttsc` sends them together in tsconfig plugin order. Apply them in order if your plugin supports a pipeline.

## Exit and Output

- `0`: success.
- `2`: argument/config/diagnostic failure.
- Any other non-zero: runtime failure.
- `stderr` is shown to users; format errors for humans.
- `transform` stdout is captured only when `--out` is absent.
- `output` should write the resulting file content to `--file` or `--out`.

## Compatibility Rules

Within `contractVersion: 1`:

- `ttsc` may add optional flags.
- `ttsc` may add JSON fields.
- `ttsc` will not rename or remove current fields without a protocol bump.

So plugin binaries should ignore unknown flags and unknown JSON fields.
