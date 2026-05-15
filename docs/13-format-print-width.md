# format/print-width — Prettier-style line reflow

Reader: package user enabling `format/print-width` in their `lint.config.ts` or `tsconfig.json`.

`format/print-width` is the lint sidecar's column-aware reflow rule.
It mirrors prettier's `printWidth`, `tabWidth`, `useTabs`, and
`endOfLine`. Enable it to make `ttsc format` (and `ttsc fix`) rewrite
overflowing list-shaped expressions to their multi-line form, and
overly broken short expressions back to a single line.

```ts
import type { TtscLintConfig } from "@ttsc/lint";

export default {
  rules: {
    "format/print-width": [
      "warning",
      { printWidth: 80, tabWidth: 2, useTabs: false, endOfLine: "lf" },
    ],
  },
} satisfies TtscLintConfig;
```

## What it reflows today

The v1 rule covers the following node shapes. Anything else passes
through verbatim — `ttsc format` will never delete or rearrange bytes
the printer does not fully understand.

| Shape                                  | Example before                                          | Example after (`printWidth: 20`)                        |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| Object literal                         | `const x = { aaa: 1, bbb: 2, ccc: 3 };`                 | multi-line with trailing comma                          |
| Array literal                          | `const x = ["alpha", "beta", "gamma"];`                 | multi-line with trailing comma                          |
| Call expression                        | `process(aaaaaa, bbbbbb, cccccc);`                      | callee on head line, one arg per indented line          |
| `new` expression                       | `new Foo(aaaaaa, bbbbbb, cccccc);`                      | same as call, with the `new` keyword preserved          |
| Type-argument call                    | `foo<Alpha>(aaaaaa, bbbbbb, cccccc);`                    | type arguments stay flat; value arguments break         |
| Optional-call (`foo?.()`)              | `foo?.(aaaaaa, bbbbbb, cccccc);`                        | `?.` token preserved between callee and `(`             |
| Named imports                          | `import { alpha, bravo, charlie } from "x";`            | multi-line specifier list                               |
| Named exports                          | `export { alpha, bravo, charlie };`                     | multi-line specifier list                               |
| `import type { … }`                    | preserves the `type` modifier                           | same                                                    |

## What it does NOT touch

- JSX elements and fragments.
- Conditional, binary, and arrow expressions.
- Destructuring patterns.
- Decorators.
- Multi-line string and template literals.
- Comments that live between members of a covered list (the rule
  detects them and abstains for that node).
- Combined `import Default, { … }` and `import * as ns from "x"`
  declarations.
- Import-attribute clauses (`import { … } from "x" with { … };` /
  `… assert { … };`) — the surrounding declaration falls back to
  verbatim so the attribute payload is never disturbed.

For every uncovered shape the rule produces zero findings and zero
edits. The same shape can be revisited in a future slice without
breaking existing files.

## How it decides to reflow

For each visited node:

1. The dispatcher in `print_dispatch.go` picks the per-node printer
   registered for that kind. If none exists, the node falls back to
   verbatim and the rule abstains.
2. The printer builds a [Wadler doc IR](https://homepages.inf.ed.ac.uk/wadler/papers/prettier/prettier.pdf)
   describing the node's flat-or-broken layout. Object literals use
   `{ items… }` with a trailing-comma `IfBreak`; arrays use `[items…]`;
   call expressions stitch the callee verbatim onto the argument list.
3. The engine in `print_engine.go` measures the flat projection's
   width against `printWidth - StartingColumn`. The starting column
   accounts for whatever prefix already sits on the node's source
   line (`const x = `, `function f() {`, etc.).
4. If the flat form fits, the engine emits the single-line layout.
   If it does not, the engine breaks the surrounding group and emits
   the multi-line layout. Continuation lines align to
   `lineLeadingIndent + tabWidth`, matching prettier's convention of
   indenting relative to the line's left edge rather than the node's
   opening column.
5. The rule compares the rendered bytes to the original byte slice.
   If they differ, it emits one `TextEdit` replacing the entire node
   range with the new bytes. If they match, nothing happens — this is
   what keeps `ttsc format` idempotent.

The starting column and base indent are computed by the rule itself
(`leadingColumn` and `lineLeadingIndent` in
`rules_format_print_width.go`) and fed into `PrintOptions`. The engine
itself does not know about source files.

## Interaction with other format rules

`format/print-width` typically runs alongside
`format/trailing-comma`, `format/semi`, and `format/quotes`. The
cascade in `ttsc format` re-runs every enabled rule until the file is
stable, so the order does not matter for the final output. The
trailing-comma rule's inserts and the print-width rule's reflows
target different byte ranges, so they never conflict.

If you only want reflow without trailing commas in flat lists, leave
`format/trailing-comma` at `off`. The print-width broken layout adds
its own trailing comma in broken mode via an `IfBreak`, so disabling
`format/trailing-comma` does not strip trailing commas from broken
forms produced by reflow.

## Configuring the budget

```ts
"format/print-width": [
  "warning",
  {
    printWidth: 100,     // default 80
    tabWidth: 4,         // default 2
    useTabs: true,       // default false
    endOfLine: "crlf",   // default "lf"
  },
],
```

- `printWidth` — the column budget. Statements whose flat width is
  ≤ this number stay on one line; statements that overflow break
  across lines.
- `tabWidth` — number of columns one indentation step occupies. Used
  both for column accounting and for indent expansion.
- `useTabs` — when `true`, indentation is rendered as one tab per
  `tabWidth` columns, falling back to spaces for any remainder.
- `endOfLine` — `"lf"` (default) or `"crlf"`. Every newline the
  reflow emits uses the configured terminator; the surrounding file
  bytes are left alone.

## Severity recommendation

Set `format/print-width` to `warning` while v1 coverage stabilizes.
A `warning` surfaces unformatted code in `ttsc check` without
failing the build, and `ttsc format` still applies the fix. Raise
to `error` once the rule's coverage spans every list-shape the
project's source actually uses; until then, an `error` severity
might gate CI on uncovered shapes.

## Extending coverage

New node kinds are added by extending the dispatcher:

1. Implement a `print<NodeKind>` function in a new
   `print_nodes_<kind>.go` file.
2. Wire it into `dispatchNode` in `print_dispatch.go`.
3. Add the kind to `formatPrintWidth.Visits()` and
   `isReflowKind` in `rules_format_print_width.go`.
4. Add unit tests under `packages/lint/test/printer/` (per-node Doc
   shape) and integration tests under `packages/lint/test/format/`
   (rule-level reflow snapshots).

The dispatcher's verbatim fallback means a new kind can ship as
soon as its happy-path printer is correct — gaps in the printer
gracefully revert to byte-preserving output rather than corrupting
the file.

## Limitations and known gaps

- Comments between members of a covered list cause the rule to
  abstain. Inline comment handling is the next slice of work.
- The "magic comma" hint (Prettier's preserve-multi-line trick) is
  not honored. Width is the only factor in the reflow decision.
- Long callees like
  `someLongExpression.chainedMethod.anotherCall(aaa, bbb)` only
  reflow the argument list. The callee chain breaks itself in a
  future slice when chain-aware printers land.
- The rule never inserts or removes blank lines between top-level
  statements.
