# `ttsc` and `ttsx`

![banner of ttsc and ttsx](https://private-user-images.githubusercontent.com/13158709/583518390-6df1deb5-9e8c-4f4b-9d0f-eae1cc3bb55c.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NzcwNTQ2NzUsIm5iZiI6MTc3NzA1NDM3NSwicGF0aCI6Ii8xMzE1ODcwOS81ODM1MTgzOTAtNmRmMWRlYjUtOWU4Yy00ZjRiLTlkMGYtZWFlMWNjM2JiNTVjLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA0MjQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwNDI0VDE4MTI1NVomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPTEzMzUxNTE4YThlZDYyNDZjYTVjYmRiMmZiYzAwYzYyZTkyNDk4MjVlYmI4OGZkYjE3NDllNWQzY2IxNmRhYWEmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.7MYb2S99lZfQV-BqD09ZrZwdj1C3XDyJ9nkaSEr901M)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)

A `typescript-go` toolchain for compiler-powered transforms and type-safe execution.

- **`ttsc`**: build, check, and transform.
- **`ttsx`**: execute TypeScript with type checking.
  - 10x faster than `ts-node`.
  - type checking that `tsx` does not provide.
- **transformer support**: compiler-powered libraries, such as `typia`.

> `ttsx` can run existing `typescript@6` projects.

## Setup

Install the native TypeScript preview package with `ttsc` and `ttsx`:

```bash
npm i -D ttsc ttsx @typescript/native-preview
```

Run TypeScript directly:

```bash
npx ttsx src/index.ts
```

Build, check, or watch the project:

```bash
npx ttsc
npx ttsc --noEmit
npx ttsc --watch
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

The same configuration is used by both `ttsc` and `ttsx`.

```bash
# compile
npx ttsc

# execute
npx ttsx src/index.ts
```

This gives compiler-powered libraries one transform path for both build-time and runtime execution.

## How It Works

`ttsc` is the compiler host. `ttsx` is the runtime entrypoint on top of it.

```text
ttsc ── build / check / transform
  ▲
  │
ttsx ── execute TypeScript
```

`ttsx` reuses the same compiler path as `ttsc`: project resolution, transformer loading, type checking, transformation, and cache layout.

That is why `ttsx` can be faster than `ts-node` without giving up the type checking that `tsx` does not provide.

## What Is a Transform?

A transform uses TypeScript types to generate JavaScript before runtime.

```ts
import typia, { tags } from "typia";
import { v4 } from "uuid";

const matched: boolean = typia.is<IMember>({
  id: v4(),
  email: "samchon.github@gmail.com",
  age: 30,
});
console.log(matched); // true

interface IMember {
  id: string & tags.Format<"uuid">;
  email: string & tags.Format<"email">;
  age: number &
    tags.Type<"uint32"> &
    tags.ExclusiveMinimum<19> &
    tags.Maximum<100>;
}
```

It is transformed into dedicated JavaScript:

> ```js
> import typia from "typia";
> import * as __typia_transform__isFormatEmail from "typia/lib/internal/_isFormatEmail";
> import * as __typia_transform__isFormatUuid from "typia/lib/internal/_isFormatUuid";
> import * as __typia_transform__isTypeUint32 from "typia/lib/internal/_isTypeUint32";
> import { v4 } from "uuid";
>
> const matched = (() => {
>   const _io0 = (input) =>
>     "string" === typeof input.id &&
>     __typia_transform__isFormatUuid._isFormatUuid(input.id) &&
>     "string" === typeof input.email &&
>     __typia_transform__isFormatEmail._isFormatEmail(input.email) &&
>     "number" === typeof input.age &&
>     __typia_transform__isTypeUint32._isTypeUint32(input.age) &&
>     19 < input.age &&
>     input.age <= 100;
>   return (input) => "object" === typeof input && null !== input && _io0(input);
> })()({
>   id: v4(),
>   email: "samchon.github@gmai19l.com",
>   age: 30,
> });
> console.log(matched); // true
> ```

`ttsc` runs this transform during build, and `ttsx` runs through the same transform path during execution.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/camwiegert/typical) and [`tsgonest`](https://github.com/tsgonest/tsgonest)