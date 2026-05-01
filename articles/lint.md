---
title: "@ttsc/lint - I made 20x faster TS Lint by building it into typescript-go — one compile catches both"
published: false
description: "One compile pass for type checks and lint — built into typescript-go, ~20x faster than tsc + ESLint in theory."
tags: typescript, javascript, compilers, tooling
cover_image: https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg
---

## TL;DR

- A typical TypeScript project runs `tsc` for type checking, then runs `eslint` again for code style.
- `@ttsc/lint` collapses those two steps into **a single compile pass**. Lint violations come out as plain compile errors.
- It's built on `typescript-go` (the next-generation TS compiler rewritten in Go, **about 10x faster** than legacy `tsc`), and reuses the AST the compiler already builds — so there is **no extra parsing cost**.
- Combine "two steps into one" with "JavaScript moved to Go," and you get **about 20x faster, in theory**.
- **Compatible with TypeScript v6** — drop on top with `ttsx` or `ttsc --noEmit`, no migration.

> GitHub Repository:
>
> - https://github.com/samchon/ttsc
> - https://github.com/samchon/ttsc/tree/master/packages/lint

---

## 1. The thing every TypeScript developer does twice a day

If you've ever set up a TypeScript project, this pair of commands will look familiar.

```bash
# Are the types correct?
tsc --noEmit

# Is the code style okay?
eslint "src/**/*.ts"
```

CI runs them separately. Build scripts run them separately. It's a little odd when you stop and think about it: these two tools are basically doing **half of the same job** each.

- `tsc`: read the source → parse it into an AST → look at types.
- `eslint`: read the source → parse it into an AST → look at patterns.

Same source, read twice. Parsed twice. And both have to pass before your build can move on.

What if you could do it in one pass?

---

## 2. What `@ttsc/lint` looks like in practice

Say you wrote this file.

```typescript
var x: number = 3;
let y: number = 4;
const z: string = 5;

console.log(x + y + z);
```

There are three problems here.

1. `var` — usually caught by the `no-var` lint rule.
2. `let y` is never reassigned — caught by `prefer-const`.
3. Assigning the number `5` to a `string` — that's an actual **type error**.

If you only run `tsc`, only #3 trips. You need a separate ESLint pass to catch #1 and #2.

Run `ttsc` with `@ttsc/lint` enabled, and the output looks like this:

```bash
$ pnpm ttsc
src/lint.ts:3:7 - error TS2322: Type 'number' is not assignable to type 'string'.

3 const z: string = 5;
        ~

src/lint.ts:2:5 - error TS17397: [prefer-const] Use const instead of let.

2 let y: number = 4;
      ~~~~~~~~~~~~~

src/lint.ts:1:1 - error TS11966: [no-var] Unexpected var, use let or const instead.

1 var x: number = 3;
  ~~~~~~~~~~~~~~~~~~

Found 3 errors in the same file, starting at: src/lint.ts:3
```

All three diagnostics come out together, in **one compile output**.

Notice that the lint violations are reported in `error TSxxxxx` format — exactly the same shape as a real type error. As far as the compiler is concerned, lint violations and type errors are the same kind of compile error. The exit code is non-zero, and CI that simply runs the equivalent of `tsc` will now block on lint violations too — no extra wiring required.

> Severities are `"error"`, `"warning"`, or `"off"`. Rules set to `"warning"` are reported but don't change the exit code, which makes gradual rollout easy.

---

## 3. So what is `ttsc`?

![banner of ttsc](https://raw.githubusercontent.com/samchon/ttsc/refs/heads/master/assets/og.jpg)

In one sentence: `ttsc` is **a compiler toolchain that adds a plugin system on top of `typescript-go`**.

`typescript-go` is the next-generation TypeScript compiler being built by Microsoft — the existing JavaScript-implemented `tsc` rewritten in Go. Per the official numbers it is **about 10x faster than legacy `tsc`**, and it will be the engine behind TypeScript v7. The catch: it doesn't yet expose a plugin slot, so there's no built-in way to wire transformers into it. `ttsc` is the tool that fills in that missing plugin slot.

`ttsc` ships two CLI commands.

- **`ttsc`**: build, type-check, watch. The slot legacy `tsc` used to fill.
- **`ttsx`**: run TypeScript files directly. Where `ts-node` and `tsx` live.
  - **About 10x faster than `ts-node`** (because it's running on `typescript-go` too).
  - `tsx` is fast but skips type checking. `ttsx` **type-checks before running**. So you get `tsx`-class speed with `ts-node`-class safety.

Install:

```bash
npm i -D ttsc @typescript/native-preview @ttsc/lint
```

Then add the lint plugin to `compilerOptions.plugins` in your `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "config": {
          "no-var": "error",
          "prefer-const": "error",
          "no-explicit-any": "warning"
        }
      }
    ]
  }
}
```

Rules are off by default — you turn them on explicitly. Start with one or two and ramp up.

Then build the way you always have:

```bash
npx ttsc
npx ttsc --watch
npx ttsc --noEmit
```

Watch mode behaves the same way. To repeat the point: lint violations are not separate warnings or IDE squiggles — they are plain **compile errors**, blocking the build the same way a type error does.

---

## 4. Why can type checking and lint share one pass?

The real cost in the classic ESLint workflow isn't that you're running two tools. It's that you're **parsing the same source twice**.

To analyze a TypeScript file, you first tokenize the text, then build a tree (AST). Only after that can you ask "what type is this node?" or "does this node match a pattern?".

- `tsc` builds its own AST, looks at types, throws it away.
- `eslint` builds its own AST (usually via `@typescript-eslint/parser`), looks for patterns, throws it away.

`@ttsc/lint` slots into the gap and **borrows the AST that `typescript-go` already built**. While the compiler is walking the tree to type-check, the lint rules walk the same tree and report violations. No new parser, no new tree.

Three things follow:

1. **Outputs merge.** One compiler emits all the diagnostics, so you get type errors (`TS2322`) and lint violations (`TS17397`, `TS11966`) in the same format in the same output. CI configuration shrinks.
2. **No extra parsing cost.** The AST is built once. Only the rule checks themselves are added work.
3. **And those rule checks run in Go.** Classic ESLint runs in JavaScript. Legacy `tsc` runs in JavaScript. `@ttsc/lint`'s rule implementation runs in the same Go runtime as `typescript-go`.

Multiply the three:

- Two passes collapsed into one: about 2x.
- JavaScript implementation moved to Go: about 10x (per the `typescript-go` official numbers).
- Multiplied: **about 20x, in theory**.

> ⚠️ This is just an **arithmetic upper bound**. `typescript-go` has not shipped officially yet (it lands with TypeScript v7), so I can't promise precise benchmark numbers ahead of that. Formal benchmarks will be published when v7 ships. For now, take this as the intuitive story: "one pass instead of two, in Go instead of JS — so it should be much faster."

Strip the multipliers away and the story is plain: lint got rolled into the compile pass.

---

## 5. So what is a "transformer"?

`@ttsc/lint` is actually one flavor of a broader concept that `ttsc` supports: a **transformer plugin**. In this case, a transformer that emits diagnostics rather than changing code.

A transformer, in one line:

> **Code that uses TypeScript type information to generate or modify JavaScript at compile time.**

At runtime, types are gone. TypeScript erases them on the way to JavaScript, so there's no general way to ask, at runtime, "what was this object's field type supposed to be?"

A transformer hooks in at the moment when the compiler is alive and **still knows the types**. It looks at those types and produces code. Information that only existed in the type system survives into the runtime output.

---

## 6. Example: typia

Easier to show than to describe. [`typia`](https://github.com/samchon/typia) is a library that generates validation functions from TypeScript types.

Imagine you write this:

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

`typia.is<IMember>(...)` checks whether the input matches `IMember`. A normal library couldn't do this from a TypeScript type alone — `IMember` is a TypeScript type, and at runtime it doesn't exist.

`typia` is a transformer. At compile time, it expands the `IMember` type, **builds the validation code that matches that exact type**, and replaces the `typia.is<IMember>(...)` call with that code. So the compile output looks like this:

```js
import typia from "typia";
import * as __typia_transform__isFormatEmail from "typia/lib/internal/_isFormatEmail";
import * as __typia_transform__isFormatUuid from "typia/lib/internal/_isFormatUuid";
import * as __typia_transform__isTypeUint32 from "typia/lib/internal/_isTypeUint32";
import { v4 } from "uuid";

const matched = (() => {
  const _io0 = (input) =>
    "string" === typeof input.id &&
    __typia_transform__isFormatUuid._isFormatUuid(input.id) &&
    "string" === typeof input.email &&
    __typia_transform__isFormatEmail._isFormatEmail(input.email) &&
    "number" === typeof input.age &&
    __typia_transform__isTypeUint32._isTypeUint32(input.age) &&
    19 < input.age &&
    input.age <= 100;
  return (input) => "object" === typeof input && null !== input && _io0(input);
})()({
  id: v4(),
  email: "samchon.github@gmail.com",
  age: 30,
});
console.log(matched);
```

What started as a generic-looking call has been replaced, at compile time, with validation logic specialized to `IMember`. The user only wrote `typia.is<IMember>(...)`, but the output has bespoke checking code baked in.

That's a transformer. `@ttsc/lint` plugs into the same slot — it's just a transformer that **reports violations as diagnostics** instead of rewriting code.

`ttsc` is the compiler that standardizes and exposes this transformer slot, which is why tools like `@ttsc/lint` can be wired in at all.

> The same plugin configuration applies to both `ttsc` and `ttsx`. A transformer that runs at build time runs the same way when you execute the file directly with `ttsx`.

---

## 7. Wrapping up

Bringing it back to the start:

- In a TypeScript project, you usually use `tsc` for types and `eslint` for style.
- `@ttsc/lint` pulls lint rules into the compiler so **one compile catches both**.
- This works because `@ttsc/lint` reuses the AST `typescript-go` already built. No double parsing.
- And because it runs in Go instead of JavaScript, **two-into-one × JS-to-Go = about 20x faster, in theory** (formal benchmarks coming with TS v7).
- The thing that makes all of this possible is `ttsc`'s transformer plugin system. Tools like `typia` and `@ttsc/lint` — anything that wants to use compile-time type information — plug into the same slot.

If you want to try it, it's three steps.

**1. Install:**

```bash
npm i -D ttsc @typescript/native-preview @ttsc/lint
```

**2. Add the plugin entry to your `tsconfig.json`** under `compilerOptions.plugins` (turn on whichever rules you want — they're all off by default):

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/lint",
        "config": {
          "no-var": "error",
          "prefer-const": "error",
          "no-explicit-any": "warning"
        }
      }
    ]
  }
}
```

**3. Run it like you always have:**

```bash
npx ttsc
```

That's the whole setup. Type errors and lint violations show up together, in one go.

> 💡 **You don't have to wait for TypeScript v7 to use this.** `@typescript/native-preview` is a side-by-side package — install it next to your existing TypeScript v6 toolchain and your current `tsc` build keeps working untouched. Drop `ttsc` on top and pick whichever overlay fits:
>
> - Run files with `ttsx` instead of `ts-node`/`tsx` (`tsx`-class speed, with type checking).
> - Run `ttsc --noEmit` in CI or pre-commit to get the type-check + lint pass — about 10x faster than legacy `tsc`, no build artifacts touched.
>
> No migration, no commitment. Try the overlay today, keep your existing pipeline.

Repo links one more time — [`samchon/ttsc`](https://github.com/samchon/ttsc) · [`@ttsc/lint`](https://github.com/samchon/ttsc/tree/master/packages/lint). ⭐ welcome.
