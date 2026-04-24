# `ttsx`

![banner of ttsc and ttsx](https://private-user-images.githubusercontent.com/13158709/583518390-6df1deb5-9e8c-4f4b-9d0f-eae1cc3bb55c.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzcwNTQ2NzUsIm5iZiI6MTc3NzA1NDM3NSwicGF0aCI6Ii8xMzE1ODcwOS81ODM1MTgzOTAtNmRmMWRlYjUtOWU4Yy00ZjRiLTlkMGYtZWFlMWNjM2JiNTVjLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA0MjQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwNDI0VDE4MTI1NVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTEzMzUxNTE4YThlZDYyNDZjYTVjYmRiMmZiYzAwYzYyZTkyNDk4MjVlYmI4OGZkYjE3NDllNWQzY2IxNmRhYWEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.7MYb2S99lZfQV-BqD09ZrZwdj1C3XDyJ9nkaSEr901M)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/ttsx.svg)](https://www.npmjs.com/package/ttsx)
[![NPM Downloads](https://img.shields.io/npm/dm/ttsx.svg)](https://www.npmjs.com/package/ttsx)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)

A `typescript-go` runner for type-safe TypeScript execution.

- **Type checking before execution**: code with compiler errors does not run.
- **Transformer support**: `ttsx` uses the same transform path as `ttsc`.
- **Fast local scripts**: a `ts-node` / `tsx`-style CLI on top of the native compiler lane.

`ttsx` is the runtime entrypoint for the `ttsc` toolchain. Use it when you want to execute TypeScript directly while keeping the same project resolution, type checking, and transformer behavior that your build uses.

## Setup

Install the native TypeScript preview package with `ttsx`:

```bash
npm i -D ttsx @typescript/native-preview
```

Run TypeScript directly:

```bash
npx ttsx src/index.ts
```

Pass arguments to the executed program after `--`:

```bash
npx ttsx src/index.ts -- --port 3000
```

`ttsx` depends on `ttsc`, so installing `ttsx` also installs the compiler host. Install `ttsc` explicitly when your project scripts call the `ttsc` CLI directly.

## Transformer Configuration

`ttsx` reads the same `compilerOptions.plugins` configuration that `ttsc` reads from `tsconfig.json`.

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "typia/lib/transform" }
    ]
  }
}
```

The same configuration is used for build-time and runtime execution:

```bash
# compile
npx ttsc

# execute
npx ttsx src/index.ts
```

This gives compiler-powered libraries one transform path for emitted JavaScript and directly executed TypeScript.

## How It Works

`ttsc` is the compiler host. `ttsx` is the runtime entrypoint on top of it.

```text
ttsc ── build / check / transform
  ▲
  │
ttsx ── execute TypeScript
```

Before user code runs, `ttsx` resolves the project, reads `tsconfig.json`, loads configured transformers, type checks the program, and transforms the entrypoint through `ttsc`.

That means:

- invalid `tsconfig.json` files are rejected.
- type checking failures stop execution.
- transformed output is what Node receives.
- the same plugin configuration works for `ttsc` and `ttsx`.

## CLI

```bash
ttsx [options] <entry.ts> [-- <argv...>]
```

Common options:

```bash
ttsx src/index.ts
ttsx --project tsconfig.json src/index.ts
ttsx --cwd packages/app src/index.ts
ttsx --cache-dir .cache/ttsx src/index.ts
ttsx -r dotenv/config src/index.ts
```

Supported options:

- `-P, --project <file>`: use an explicit `tsconfig.json`.
- `--cwd <dir>`: resolve the project and entrypoint from another directory.
- `--cache-dir <dir>`: override the compiled output cache directory.
- `--binary <path>`: force a particular `ttsc` native binary.
- `-r, --require <file>`: preload a CommonJS module before the entrypoint.
- `-h, --help`: print CLI help.
- `-v, --version`: print the installed version.

`--` separates `ttsx` options from entrypoint arguments:

```bash
ttsx src/server.ts -- --port 8080 --watch
```

Inside the executed program:

```ts
process.argv;
// [node, /abs/path/src/server.ts, "--port", "8080", "--watch"]
```

## Runtime Model

`ttsx` has two execution paths.

### CommonJS

For CommonJS projects, `ttsx` installs an in-process require hook. Each TypeScript file is transformed through `ttsc.transform()`, cached, and then executed by Node in the same process.

### ESM

For ESM projects, `ttsx` builds the project into a cache directory and spawns Node on the cached JavaScript entrypoint. This keeps ESM execution on a real emitted project tree instead of forcing it through a CommonJS require hook.

The default cache location is:

```text
<project-root>/node_modules/.cache/ttsc/ttsx
```

## JS API

Use `register()` when embedding the CommonJS require hook in another tool:

```ts
import { register } from "ttsx";

const unregister = register({
  project: "tsconfig.json",
});

try {
  require("./src/index.ts");
} finally {
  unregister();
}
```

Use `prepareExecution()` when a wrapper needs to know how `ttsx` will run an entrypoint:

```ts
import { prepareExecution } from "ttsx";

const prepared = prepareExecution("src/index.ts", {
  project: "tsconfig.json",
});

console.log(prepared.moduleKind);
console.log(prepared.entryFile);
console.log(prepared.emitDir);
```

The JS API can also receive lower-level `ttsc` options such as `plugins`, `rewriteMode`, `binary`, `cwd`, `env`, `cacheDir`, and `extensions`.

## What `ttsx` Is For

Use `ttsx` for scripts, tests, local tools, and development entrypoints that should behave like the project build:

- same `tsconfig.json`
- same type checking
- same transformer configuration
- same native compiler backend selection

`ttsx` is intentionally small. Build, check, transform, plugin loading, and native backend selection are owned by `ttsc`; `ttsx` focuses on executing the checked and transformed result.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/samchon/typical) and [`tsgonest`](https://github.com/samchon/tsgonest)
