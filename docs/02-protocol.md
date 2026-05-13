# Plugin Protocol Reference

This page is the contract between `ttsc` and a plugin package.

## Manifest

The consumer points `compilerOptions.plugins[]` at a JavaScript module:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "my-plugin", "mode": "strict", "enabled": true },
    ],
  },
}
```

The module exports either a plugin object or a factory:

```js
const path = require("node:path");

module.exports = (context) => ({
  name: "my-plugin",
  source: path.resolve(__dirname, "go-plugin"),
  stage: "transform",
});
```

`context` contains:

```ts
{
  binary: string;
  cwd: string;
  plugin: ITtscProjectPluginConfig;
  projectRoot: string;
  tsconfig: string;
}
```

`context.plugin` is the original tsconfig plugin entry. If you want stronger typing, specialize the context type in your factory:

`context.binary` is the absolute `ttsc` native helper selected for this invocation. It is not the plugin sidecar binary and not the JavaScript launcher. Most descriptors do not need it; it exists for advanced factories that need to inspect the active native host.

```ts
import * as path from "node:path";
import type { ITtscPluginFactoryContext } from "ttsc";

type MyPluginEntry = {
  transform: string;
  mode?: string;
};

export function createTtscPlugin(
  context: ITtscPluginFactoryContext<MyPluginEntry>,
) {
  return {
    name: "my-plugin",
    source: path.resolve(__dirname, "go-plugin"),
    stage: "transform",
  };
}
```

### Shape

```ts
interface ITtscPlugin {
  name: string;
  source: string;
  composes?: string[];
  stage?: "transform" | "check";
  contributors?: ITtscPluginContributor[];
}

interface ITtscPluginContributor {
  name: string;
  source: string;
}
```

Field rules:

- `name`: non-empty display name.
- `source`: Go command package directory or `go.mod` file. Relative paths are resolved from the consumer project root; package descriptors should usually return an absolute path based on `__dirname`.
- `composes`: optional list of other plugin names (or original `transform` specifiers) whose source build should be redirected to this descriptor's `source`. Composition is **one hop only**: `A.composes = ["B"]` sends B to A's binary, but if `B.composes = ["C"]` then C is sent to B's original binary, not A's. Reciprocal entries (`A.composes = ["B"]` and `B.composes = ["A"]`) are rejected as a cycle. First-party utility plugin names (`@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip`) cannot appear here; they have their own auto-composition path through the shared compiler host.
- `stage`: plugin kind. Omit for `"transform"`.
- `contributors`: optional list of additional Go source packages to statically link into this plugin's binary at build time. Each entry's `source` is copied into the scratch build tree as `<scratch>/contrib/<name>/`, and a synthesized blank import in the entry package triggers the contributor's `init()` before `main`. See [Contributors](#contributors) below.

`ttsc` accepts Go source only. It builds the source with the pinned Go toolchain and TypeScript-Go shim overlay, then caches the resulting executable.

## Stages

Public stages are deliberately small:

| Stage                   | Host behavior                                    | Binary commands               |
| ----------------------- | ------------------------------------------------ | ----------------------------- |
| omitted / `"transform"` | participates in the TypeScript-Go transform path | `check`, `transform`, `build` |
| `"check"`               | reports diagnostics before emit                  | `check`                       |

There is no public `output` stage. Plugins do not receive generated JavaScript text or emitted file text for post-processing.

## Composition

Projects can enable multiple plugin entries. `check` entries run before emit and compose with transform entries.

Transform entries can share one compiler host when they resolve to the same native binary. This is how the first-party utility plugins compose:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ttsc/banner", "text": "license" },
      { "transform": "@ttsc/strip", "calls": ["console.log"] },
    ],
  },
}
```

Distinct third-party compiler hosts cannot be chained blindly, because each one would need to own `Program` creation and emit. If several transform modes must cooperate, expose them from one native binary and dispatch by explicit mode or option fields in the `--plugins-json` payload.

### Composing across binaries

Third-party plugins that want to share one compiler host can opt in through the `composes` field on their descriptor:

```ts
module.exports = {
  name: "my-aggregate-plugin",
  source: path.resolve(__dirname, "go-plugin"),
  stage: "transform",
  composes: ["my-feature-a", "my-feature-b"],
};
```

When ttsc loads the descriptors of `my-feature-a` and `my-feature-b` from the project's `compilerOptions.plugins`, it reroutes their build target to the aggregate's `source`. All three names remain in the `--plugins-json` payload so the aggregate sidecar can dispatch by `name`. The aggregate must implement the dispatch logic itself; ttsc only redirects the binary.

Rules enforced at load time:

- Composition is one hop only. ttsc does not transitively follow `composes` arrays of composed plugins.
- Cycles (two plugins listing each other) are rejected with an explicit error.
- First-party utility names (`@ttsc/banner`, `@ttsc/paths`, `@ttsc/strip`) cannot appear in `composes`. They are composed automatically through the shared compiler host hosted by `packages/ttsc/utility/host.go`.
- The aggregate's own descriptor still needs a real `source` directory; ttsc never composes a plugin into nothing.

## Contributors

`composes` is horizontal — it lets multiple top-level plugin entries dispatch to one binary by name. `contributors` is vertical — it lets one binary statically link **additional Go sources that never appear as `compilerOptions.plugins[]` entries**. The contributing npm packages are discovered through the host plugin's own configuration (for `@ttsc/lint`, that is `lint.config.ts`'s `plugins` map).

A host plugin populates `contributors` from its factory:

```ts
import path from "node:path";

module.exports = (context) => ({
  name: "@ttsc/lint",
  source: path.resolve(__dirname, "plugin"),
  stage: "check",
  contributors: [
    { name: "demo", source: "/abs/path/to/lint-contributor-demo/rules" },
  ],
});
```

ttsc's plugin builder then:

1. Copies the host plugin's source to a scratch directory.
2. Copies each contributor's `source` into `<scratch>/contrib/<contributor.name>/`.
3. Synthesizes a `ttsc_contributions.go` next to the host's entry package with one blank import per contributor: `import _ "<host-module-path>/contrib/<name>"`.
4. Hashes every contributor source directory into the binary cache key (so swapping a contributor invalidates the cache).
5. Runs `go build`. The resulting binary has every contributor's `init()` already executed by the time `main` starts.

Constraints enforced at load time:

- Contributors ship Go source as a **package**, not a Go module. A contributor with its own `go.mod` is rejected. The host plugin's `go.mod` supplies every transitive Go dependency, which also closes the supply-chain hole where a contributor could otherwise pull in arbitrary Go modules at build time.
- `contributor.name` must match `/^[a-z][a-z0-9_]*$/` (it forms the final import-path suffix and must be a valid Go identifier). The lint factory derives this by mapping the user-facing namespace's hyphens to underscores — namespace `react-hooks` becomes contributor name `react_hooks`. The Go source's `package` declaration must match the post-transform name.
- `contributor.source` must be an absolute path to an existing directory.
- Contributor names must be unique within one plugin build.
- The host plugin's source must not already ship a `contrib/` directory or a `ttsc_contributions.go` file at its entry root; both are scratch-space reserved for the build pipeline.
- A composed plugin (one redirected by another's `composes`) cannot declare its own `contributors` — move them onto the aggregate, or drop the `composes` redirect.

The cache key derivation for a plugin with N contributors is `ttsc + tsgo + platform + entry + Σ(contributor source hashes) + plugin source hash + overlay source hashes`, so consumers with the same logical set of contributors share one cached binary regardless of declaration order.

## Plugin Config Keys

`ttsc` reads only `transform` and `enabled` from each user plugin entry. Every other key remains plugin-owned config and is passed through unchanged to the native sidecar.

ts-patch words such as `before`, `after`, or `phase` do not affect `ttsc` execution. If a plugin package chooses to use those names for its own config, they are ordinary plugin data. Package descriptors choose only between the public `"transform"` and `"check"` stages.

## Disabled Entries

`enabled: false` disables a plugin entry before loading:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "my-plugin", "enabled": false },
      { "transform": "other-plugin" },
    ],
  },
}
```

Disabled entries are not resolved, built, or included in `--plugins-json`.

## CLI Commands

The built Go binary receives subcommands. Unknown flags should be ignored so future `ttsc` minors can add optional flags.

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
  --plugins-json='[...]'
```

Run diagnostics only. Write diagnostics to stderr. Exit non-zero for errors.

### `transform`

```bash
my-plugin transform \
  --cwd=/project \
  --tsconfig=/project/tsconfig.json \
  --plugins-json='[...]'
```

Project-wide source transform used by `ttsc.transform()` and in-memory callers. Write JSON to stdout:

```json
{
  "diagnostics": [],
  "typescript": {
    "src/main.ts": "export const value = 1;\n"
  }
}
```

### `build`

```bash
my-plugin build \
  --cwd=/project \
  --tsconfig=/project/tsconfig.json \
  --plugins-json='[...]' \
  --emit \
  --outDir=/project/dist
```

Project-wide transform build. Run diagnostics and write TypeScript-Go outputs.

## `--plugins-json`

`--plugins-json` is a JSON array of loaded plugin descriptors for the current command:

```json
[
  {
    "name": "my-plugin",
    "stage": "transform",
    "config": {
      "transform": "my-plugin",
      "mode": "strict"
    }
  }
]
```

`config` is the original tsconfig plugin entry. Read user options there.

When multiple entries resolve to the same binary, `ttsc` sends them together. Select the entry you need by `name`, `mode`, or plugin-owned option fields.

## Exit and Output

- `0`: success.
- `2`: argument/config/diagnostic failure.
- Any other non-zero: runtime failure.
- `stderr` is shown to users; format errors for humans.
- `transform` stdout must be the JSON shape above.
- `build` writes project outputs through TypeScript-Go emit.

## Compatibility Rules

Within the current protocol:

- `ttsc` may add optional flags.
- `ttsc` may add JSON fields.
- `ttsc` will not rename or remove current fields without a protocol bump.

So plugin binaries should ignore unknown flags and unknown JSON fields.
