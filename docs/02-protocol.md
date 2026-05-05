# Plugin Protocol Reference

This page is the contract between `ttsc` and a plugin package.

## Manifest

The consumer points `compilerOptions.plugins[]` at a JavaScript module:

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

module.exports = (context) => ({
  name: "my-plugin",
  source: path.resolve(__dirname, "go-plugin"),
  stage: "transform",
  hooks: { source: true },
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

`context.plugin` is the original tsconfig plugin entry. If you want stronger
typing, specialize the context type in your factory:

```ts
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
    source: "go-plugin",
    stage: "transform",
    hooks: { source: true },
  };
}
```

### Shape

```ts
interface ITtscPlugin {
  name: string;
  source: string;
  stage?: "transform" | "check";
  hooks?: {
    source?: boolean;
    declaration?: boolean;
  };
}
```

Field rules:

- `name`: non-empty display name.
- `source`: Go command package directory or `go.mod` file. Relative paths are
  resolved from the consumer project root; package descriptors should usually
  return an absolute path based on `__dirname`.
- `stage`: pipeline placement. Omit for `"transform"`.
- `hooks.source`: the package mutates TypeScript `SourceFile` AST before
  TypeScript-Go emit transforms.
- `hooks.declaration`: the package mutates declaration AST before declaration
  printing. This is a package capability, not a user tsconfig phase option.

`ttsc` accepts Go source only. It builds the source with the pinned Go toolchain
and TypeScript-Go shim overlay, then caches the resulting executable.

## Stages

Public stages are deliberately small:

| Stage | Host behavior | Binary commands |
| --- | --- | --- |
| omitted / `"transform"` | participates in the TypeScript-Go transform path | `check`, `transform`, `build` |
| `"check"` | reports diagnostics before emit | `check` |

There is no public `output` stage. Plugins do not receive generated JavaScript
text or emitted file text for post-processing.

Transform plugins must declare at least one hook:

```js
hooks: { source: true }
hooks: { source: true, declaration: true }
hooks: { declaration: true }
```

Check plugins must not declare transform hooks.

## Composition

Projects can enable multiple plugin entries. `check` entries run before emit and
compose with transform entries.

Transform entries can share one compiler host when they resolve to the same
native binary. This is how the first-party utility plugins compose:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      { "transform": "@ttsc/banner", "banner": "license" },
      { "transform": "@ttsc/paths" },
      { "transform": "@ttsc/strip", "calls": ["console.log"] }
    ]
  }
}
```

Distinct third-party compiler hosts cannot be chained blindly, because each one
would need to own `Program` creation and emit. If several transform modes must
cooperate, expose them from one native binary and dispatch by the ordered
`--plugins-json` payload.

## Rejected Phase Options

`ttsc` does not copy ts-patch placement options into user tsconfig. These keys
are rejected in plugin entries:

- `before`
- `after`
- `afterDeclarations`
- `phase`
- `source:after`

Hook placement belongs to the plugin package descriptor. Users select the plugin
and its own options only.

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

The built Go binary receives subcommands. Unknown flags should be ignored so
future `ttsc` minors can add optional flags.

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

Project-wide source transform used by `ttsc.transform()` and in-memory callers.
Write JSON to stdout:

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

`--plugins-json` is an ordered JSON array of loaded plugin descriptors for the
current command:

```json
[
  {
    "name": "my-plugin",
    "stage": "transform",
    "hooks": { "source": true },
    "config": {
      "transform": "my-plugin",
      "mode": "strict"
    }
  }
]
```

`config` is the original tsconfig plugin entry. Read user options there.

When multiple entries resolve to the same binary, `ttsc` sends them together in
tsconfig plugin order. Apply them in order if your plugin supports a pipeline.

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
