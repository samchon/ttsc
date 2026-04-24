# `ttsc`

![banner of ttsc and ttsx](https://private-user-images.githubusercontent.com/13158709/583518390-6df1deb5-9e8c-4f4b-9d0f-eae1cc3bb55c.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzcwNTQ2NzUsIm5iZiI6MTc3NzA1NDM3NSwicGF0aCI6Ii8xMzE1ODcwOS81ODM1MTgzOTAtNmRmMWRlYjUtOWU4Yy00ZjRiLTlkMGYtZWFlMWNjM2JiNTVjLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA0MjQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwNDI0VDE4MTI1NVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTEzMzUxNTE4YThlZDYyNDZjYTVjYmRiMmZiYzAwYzYyZTkyNDk4MjVlYmI4OGZkYjE3NDllNWQzY2IxNmRhYWEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.7MYb2S99lZfQV-BqD09ZrZwdj1C3XDyJ9nkaSEr901M)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)

A `typescript-go` compiler host for build-time transforms.

- **Build and check**: run the project through the native TypeScript compiler lane.
- **Transformer support**: load `compilerOptions.plugins` from `tsconfig.json`.
- **Library author surface**: publish `ttsc` plugins with native backends or JS output hooks.

`ttsc` is the compiler host used by `ttsx`. Use `ttsc` when you want one project-aware path for type checking, JavaScript emit, transformer loading, and native backend selection.

## Setup

Install the native TypeScript preview package with `ttsc`:

```bash
npm i -D ttsc @typescript/native-preview
```

Build, check, or watch the project:

```bash
npx ttsc
npx ttsc --noEmit
npx ttsc --watch
```

Transform a single file:

```bash
npx ttsc transform --file src/index.ts
```

## Transformer Configuration

`ttsc` reads `compilerOptions.plugins` from `tsconfig.json`.

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "typia/lib/transform" }
    ]
  }
}
```

The same configuration is used by `ttsc` and `ttsx`.

```bash
# compile
npx ttsc

# execute
npx ttsx src/index.ts
```

This gives compiler-powered libraries one transform path for build-time and runtime execution.

## CLI

```bash
ttsc [options]
ttsc transform --file <path> [options]
ttsc version
```

Common commands:

```bash
ttsc
ttsc -p tsconfig.json
ttsc --noEmit
ttsc --watch
ttsc --outDir lib
ttsc --verbose
ttsc transform --file src/index.ts
ttsc transform --file src/index.ts --out tmp/index.js
```

Supported options:

- `-p, --project <file>`: resolve project settings from this config file.
- `--tsconfig <file>`: alias for an explicit project config file.
- `--cwd <dir>`: resolve project-relative paths from another directory.
- `--emit`: force emitted files during build.
- `--noEmit`: type check and transform without writing emitted files.
- `-w, --watch`: rebuild when project files change.
- `--preserveWatchOutput`: keep watch output on screen.
- `--outDir <dir>`: override `compilerOptions.outDir`.
- `--rewrite-mode <mode>`: force a native rewrite backend id.
- `--quiet`: keep native build output quiet.
- `--verbose`: print the native build summary and emitted files.
- `--out <path>`: write single-file transform output to a file.
- `--binary <path>`: use an explicit native backend binary.

Compatibility aliases:

```bash
ttsc build
ttsc check
```

`ttsc build` is the same project build lane as `ttsc`. `ttsc check` is the same as `ttsc --noEmit`.

## JS API

`ttsc` exposes a small JS API for bundlers, runners, and higher-level tools.

```ts
import { build, check, transform, version } from "ttsc";
```

Transform one file:

```ts
import { transform } from "ttsc";

const code = transform({
  cwd: "/project",
  file: "/project/src/index.ts",
  tsconfig: "/project/tsconfig.json",
});
```

Build or check a project:

```ts
import { build, check } from "ttsc";

const built = build({
  cwd: process.cwd(),
  tsconfig: "tsconfig.json",
  emit: true,
});

if (built.status !== 0) {
  console.error(built.stderr);
}

const checked = check({
  tsconfig: "tsconfig.json",
});
```

`transform()` throws when the native compiler exits with an error. `build()` and `check()` return `{ status, stdout, stderr }`, so callers can decide how to surface compiler failures.

## Transformer Library Authors

Transformer libraries publish a normal tsconfig plugin entry:

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "my-lib/lib/transform" }
    ]
  }
}
```

The `transform` value may be:

- a package specifier.
- an absolute path.
- a relative path from the project root.

The plugin module may export a plugin object directly, a default export, a `plugin` export, or a `createTtscPlugin` factory.

```ts
import { definePlugin } from "ttsc";

export default definePlugin((config, context) => ({
  name: "my-lib",
  native: {
    mode: "my-lib",
    binary: require.resolve("my-lib-native/bin/ttsc-my-lib.js"),
    contractVersion: 1,
    capabilities: ["rewrite", "diagnostics"],
  },
}));
```

The factory receives:

- `config`: the raw `compilerOptions.plugins[]` entry.
- `context.binary`: the fallback `ttsc` native binary path.
- `context.cwd`: the invocation working directory.
- `context.projectRoot`: the resolved project root.
- `context.tsconfig`: the resolved config file path.

Keep this Node-side entry small. Use it for package discovery, feature flags, native binary selection, and manifest construction. Put compiler-sensitive work in the native backend.

## Native Backend Contract

A native transform plugin describes the backend that owns type analysis and rewrite work.

```ts
import { definePlugin } from "ttsc";

export default definePlugin(() => ({
  name: "my-lib",
  native: {
    mode: "my-lib",
    binary: require.resolve("my-lib-native/bin/ttsc-my-lib.js"),
    contractVersion: 1,
    capabilities: ["rewrite", "diagnostics", "assets"],
  },
}));
```

Descriptor shape:

```ts
interface TtscNativeBackend {
  mode: string;
  binary?: string;
  contractVersion?: 1;
  capabilities?: readonly string[];
}
```

- `mode` is the rewrite backend id passed to the native compiler process.
- `binary` points at a consumer-owned native binary.
- `contractVersion` pins the plugin to the current host protocol.
- `capabilities` records the backend responsibilities.

The backend is responsible for the work old TypeScript transformer libraries used to do through in-process compiler APIs:

- loading the project through the `typescript-go` lane.
- finding marker calls such as `typia.is<T>()`.
- analyzing types through native checker access or a serialized IR.
- emitting replacement JavaScript.
- reporting plugin-specific diagnostics.
- emitting plugin-owned assets when needed.

## JS Output Hooks

For text-level post-processing, a plugin can provide `transformOutput()`.

```ts
import { definePlugin } from "ttsc";

export default definePlugin((config) => ({
  name: "banner-plugin",
  transformOutput(context) {
    if (context.command === "build") {
      return `/* generated by ${config.transform} */\n${context.code}`;
    }
    return context.code;
  },
}));
```

`transformOutput()` receives JavaScript text after native emit. Use it for:

- banner injection.
- output string patching.
- runtime helper import rewrites.
- consumer-specific output normalization.

Use a native backend for compiler-sensitive work:

- type analysis.
- AST mutation.
- call-site recognition.
- `ts.Program` / `ts.TypeChecker` transformer compatibility.

## Current Constraints

These are current host constraints transformer authors should design around.

- One invocation can select one native `mode` / `binary` pair.
- Multiple text-only `transformOutput()` plugins can run in order.
- Passing `plugins` to the JS API replaces the tsconfig plugin list.
- `transformOutput()` is a JS text hook, not a JS AST hook.
- The current setup lane is `@typescript/native-preview`.

## Integration Patterns

Consumer library:

- publish a tsconfig plugin entry such as `my-lib/lib/transform`.
- resolve a consumer-owned native backend binary from that entry.
- keep type analysis and rewrite logic in the native backend.
- optionally layer `transformOutput()` for final JavaScript text normalization.

Bundler adapter:

- call `transform()` for per-file rewrites.
- pass `plugins` when the adapter needs deterministic plugin state.
- let `ttsc` resolve the native backend instead of spawning it manually.

Runner:

- use `ttsx` for direct execution.
- reuse the same `compilerOptions.plugins` contract.
- keep build-time and runtime transform behavior aligned.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/samchon/typical) and [`tsgonest`](https://github.com/samchon/tsgonest)
