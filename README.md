# `ttsc`

![banner of ttsc](https://private-user-images.githubusercontent.com/13158709/583518390-6df1deb5-9e8c-4f4b-9d0f-eae1cc3bb55c.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzcwNTQ2NzUsIm5iZiI6MTc3NzA1NDM3NSwicGF0aCI6Ii8xMzE1ODcwOS81ODM1MTgzOTAtNmRmMWRlYjUtOWU4Yy00ZjRiLTlkMGYtZWFlMWNjM2JiNTVjLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA0MjQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwNDI0VDE4MTI1NVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTEzMzUxNTE4YThlZDYyNDZjYTVjYmRiMmZiYzAwYzYyZTkyNDk4MjVlYmI4OGZkYjE3NDllNWQzY2IxNmRhYWEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.7MYb2S99lZfQV-BqD09ZrZwdj1C3XDyJ9nkaSEr901M)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)

A `typescript-go` toolchain for compiler-powered transforms and type-safe execution.

- **`ttsc`**: build, check, watch, and transform.
- **`ttsx`**: execute TypeScript with type checking.
- **transformer support**: compiler-powered libraries, such as `typia`.

`ttsc` is one npm package. It provides both commands.

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

Run TypeScript directly:

```bash
npx ttsx src/index.ts
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

The same configuration is used for build-time and runtime execution:

```bash
# compile
npx ttsc

# execute
npx ttsx src/index.ts
```

This gives compiler-powered libraries one transform path for emitted JavaScript and directly executed TypeScript.

## How It Works

`ttsc` is the compiler host. `ttsx` is the runtime command shipped by the same package.

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
- the same plugin configuration works for compile and run.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- TypeScript-Go examples: [`typical`](https://github.com/samchon/typical) and [`tsgonest`](https://github.com/samchon/tsgonest)
