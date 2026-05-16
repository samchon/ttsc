# Migrating from Prettier to `@ttsc/lint`

Reader: a project that maintains a `.prettierrc` (or equivalent) and wants to fold Prettier's formatting into `ttsc`'s single-pass typecheck + lint + format pipeline.

`@ttsc/lint` exposes a Prettier-style flat-config block under the top-level `format` key of `lint.config.ts`. Most `.prettierrc` files port over almost verbatim. This guide enumerates the supported keys, shows the copy-paste pattern, and lists the Prettier knobs that are not yet implemented.

## Field-by-field cheat sheet

| `.prettierrc` key | `format` key | Notes |
| --- | --- | --- |
| `printWidth` | `printWidth` | Identical default (80). |
| `tabWidth` | `tabWidth` | Identical default (2). |
| `useTabs` | `useTabs` | Identical default (false). |
| `semi` | `semi` | `true` → `format/semi` with `prefer: "always"`; `false` → `prefer: "never"`. |
| `singleQuote` | `singleQuote` | Identical default (false = double quotes). |
| `trailingComma` | `trailingComma` | `"all"` / `"es5"` / `"none"`. Identical default (`"all"`). |
| `endOfLine` | `endOfLine` | `"lf"` and `"crlf"` only — `"cr"` and `"auto"` are intentionally unsupported. |
| (sort-imports) | `importOrder`, `importOrderSeparation`, `importOrderSortSpecifiers`, `importOrderCaseInsensitive` | Mirrors `@trivago/prettier-plugin-sort-imports`. Setting `importOrder` enables `format/sort-imports`. |
| (jsdoc) | `jsdoc: true` or `jsdoc: { tagSynonyms, sortTags }` | Mirrors `prettier-plugin-jsdoc`. MVP rewrites tag synonyms (`@return → @returns`, etc). |
| (none) | `severity` | `"off" | "warn" | "warning" | "error"`. Sets the diagnostic severity for every format rule in `ttsc check`. Default `"warning"`. No Prettier analogue. |

## Sample migration

`.prettierrc`:

```jsonc
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "endOfLine": "lf"
}
```

becomes `lint.config.ts`:

```ts
import type { TtscLintConfig } from "@ttsc/lint";

export default {
  format: {
    printWidth: 100,
    singleQuote: true,
    trailingComma: "all",
    endOfLine: "lf",
  },
} satisfies TtscLintConfig;
```

If you also had `eslint.config.js` with `eslint-plugin-prettier` running Prettier as a rule, drop that plugin — `ttsc format` (and `ttsc fix`) now apply the formatting through the native sidecar in the same compile-time pass.

## What's not yet supported

The following Prettier knobs are not currently implemented:

- `bracketSpacing` — object literal padding (`{ x }` vs `{x}`). `format/print-width` uses the `{ x }` form unconditionally.
- `bracketSameLine` — JSX closing bracket placement.
- `arrowParens` — `(x) => x` vs `x => x`.
- `quoteProps` — quoting policy for object property keys.
- `jsxSingleQuote` — quote style for JSX attribute strings (`format/quotes` skips JSX strings; quote style there is preserved as-is).
- `proseWrap`, `htmlWhitespaceSensitivity`, `vueIndentScriptAndStyle` — markdown/HTML/Vue features outside the TS-only scope.
- `embeddedLanguageFormatting` — formatting code embedded in template literals.
- `singleAttributePerLine` — JSX/HTML attribute-per-line layout.
- `experimentalTernaries` — Prettier's experimental ternary layout.
- `rangeStart` / `rangeEnd` — partial-file formatting.
- `requirePragma` / `insertPragma` — pragma-gated formatting.

These items are tracked as follow-up work. The dispatcher's verbatim fallback (in `format/print-width`) preserves the source for shapes the printer doesn't yet understand, so the absence of one of these knobs cannot corrupt your code — at worst, a long JSX element won't be reflowed even when its flat form overflows.

## Migrating per-rule severities

Prettier has no severity concept; everything is "format or don't." `@ttsc/lint` runs the format rules through the same diagnostic stream as lint rules, so `ttsc check` surfaces unformatted code as a warning by default. To gate CI on formatting, use either of:

- Project-wide: `format: { severity: "error" }`.
- Per-rule: a `rules` entry overrides the block-wide severity for one rule:

  ```ts
  format: { severity: "warning" },
  rules: { "format/semi": "error" },
  ```

To temporarily disable all format checks (e.g. during a refactor) without removing the block, set `format: { severity: "off" }`. That zeros every format rule AND skips `ttsc format` rewrites — a stable one-line CI escape hatch.
