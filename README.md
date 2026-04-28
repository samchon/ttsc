# `ttsc`

![banner of ttsc](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/samchon/ttsc/blob/master/LICENSE)
[![NPM Version](https://img.shields.io/npm/v/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![NPM Downloads](https://img.shields.io/npm/dm/ttsc.svg)](https://www.npmjs.com/package/ttsc)
[![Build Status](https://github.com/samchon/ttsc/workflows/test/badge.svg)](https://github.com/samchon/ttsc/actions?query=workflow%3Atest)
[![Discord Badge](https://img.shields.io/badge/discord-samchon-d91965?style=flat&labelColor=5866f2&logo=discord&logoColor=white&link=https://discord.gg/E94XhzrUCZ)](https://discord.gg/E94XhzrUCZ)

A `typescript-go` toolchain for compiler-powered transforms and type-safe execution.

- **`ttsc`**: build, check, and transform.
- **`ttsx`**: execute TypeScript with type checking.
  - 10x faster than `ts-node`.
  - type checking that `tsx` does not provide.
- **transformer support**: compiler-powered libraries, such as `typia`.

> `ttsx` (CLI command) can run existing `typescript@6` projects.

## Setup

Install the native TypeScript preview package with `ttsc`:

```bash
npm i -D ttsc @typescript/native-preview
```

Run TypeScript directly with `ttsx` (CLI command):

```bash
npx ttsx src/index.ts
```

Build, check, or watch the project with `ttsc`:

```bash
npx ttsc
npx ttsc --noEmit
npx ttsc --watch
```

Clear cached transformer binaries when developing or debugging a plugin:

```bash
npx ttsc clean
```

## Transformer Configuration

`ttsc` reads `compilerOptions.plugins` from `tsconfig.json`. Each plugin
module is a JavaScript descriptor for an ordered native transformer backend;
the transform implementation itself runs in Go.

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "rules": {
          "no-var": "error",
          "no-explicit-any": "warn",
          "no-non-null-assertion": "off"
        }
      },
      { "transform": "typia/lib/transform" }
    ]
  }
}
```

The same configuration is used by both `ttsc` commands.

```bash
# compile
npx ttsc

# execute
npx ttsx src/index.ts
```

This gives compiler-powered libraries one transform path for both build-time and runtime execution.

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
>   email: "samchon.github@gmail.com",
>   age: 30,
> });
> console.log(matched); // true
> ```

`ttsc` runs this transform during build, and `ttsx` runs through the same transform path during execution.

## References

- TypeScript runners: [`ts-node`](https://github.com/TypeStrong/ts-node) and [`tsx`](https://github.com/privatenumber/tsx)
- Transformer tooling: [`ttypescript`](https://github.com/cevek/ttypescript) and [`ts-patch`](https://github.com/nonara/ts-patch)
- Inspired by: [`typical`](https://github.com/elliots/typical) and [`tsgonest`](https://github.com/tsgonest/tsgonest)
