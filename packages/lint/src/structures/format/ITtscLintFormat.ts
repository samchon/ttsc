import type { TtscLintSeverity } from "../TtscLintSeverity";
import type { ITtscLintFormatJsDoc } from "./ITtscLintFormatJsDoc";
import type { ITtscLintFormatSortImports } from "./ITtscLintFormatSortImports";

/**
 * Prettier-style flat configuration for the format rules.
 *
 * The `format` block is the recommended way to enable formatting in
 * `@ttsc/lint`. Each key mirrors a Prettier option of the same name, users
 * coming from a `.prettierrc` can copy their config almost verbatim. The block
 * is opt-in by presence: a `lint.config.ts` with no `format` field keeps every
 * format rule off, exactly as before.
 *
 * Once present, the block configures a curated set of format rules at
 * Prettier-aligned defaults. `ttsc format` uses these rules to rewrite source.
 * `ttsc check` does not report format findings unless `severity` is set to a
 * non-off value. Individual rules can be overridden or disabled through the
 * `rules` map (the `rules` entry wins on conflict).
 */
export interface ITtscLintFormat {
  /**
   * Check-time severity for format findings generated from this block.
   *
   * The default is `"off"` so formatting policy does not affect compilation
   * unless the project opts into that behavior. `ttsc format` can still use the
   * rest of this block to rewrite files.
   *
   * @default "off"
   */
  severity?: TtscLintSeverity;

  /**
   * Insert trailing semicolons on ASI-terminated statements. Mirrors Prettier's
   * `semi`. `false` flips the rule to require _no_ trailing semicolon (rare;
   * matches prettier's `semi: false`).
   *
   * @default true
   */
  semi?: boolean;

  /**
   * Prefer single-quoted strings. Mirrors Prettier's `singleQuote`. `false`
   * means double quotes (Prettier's default).
   *
   * @default false
   */
  singleQuote?: boolean;

  /**
   * Parenthesize a single arrow-function parameter. Mirrors Prettier's
   * `arrowParens`. `"always"` (the default) keeps `(x) => x`; `"avoid"` strips
   * the parentheses of a single bare-identifier parameter, giving `x => x`. A
   * typed, destructured, rest, optional, defaulted, or multi-parameter list
   * keeps its parentheses in both modes.
   *
   * @default "always"
   */
  arrowParens?: "always" | "avoid";

  /**
   * Pad the inside of single-line braces with one space. Mirrors Prettier's
   * `bracketSpacing`. `true` (the default) gives `{ x: 1 }`, `import { foo }`;
   * `false` gives `{x: 1}`, `import {foo}`. Applies to object literals, object
   * destructuring patterns, named imports/exports, and type literals; block,
   * class, interface, and enum braces are unaffected.
   *
   * @default true
   */
  bracketSpacing?: boolean;

  /**
   * Quoting policy for object-literal property keys. Mirrors Prettier's
   * `quoteProps`. `"as-needed"` (the default) removes quotes from a key that is
   * a valid identifier (`{ "foo": 1 }` becomes `{ foo: 1 }`), keeping them on
   * non-identifier or numeric keys (`"bar-baz"`, `"123"`). `"consistent"` keeps
   * every key quoted when any one of them requires quotes. `"preserve"` never
   * changes quoting.
   *
   * @default "as-needed"
   */
  quoteProps?: "as-needed" | "consistent" | "preserve";

  /**
   * Trailing-comma policy. Mirrors Prettier's `trailingComma`. The `"none"`
   * mode disables the rule's edits.
   *
   * @default "all"
   */
  trailingComma?: "all" | "es5" | "none";

  /**
   * Maximum column width before broken-form layout is chosen. Mirrors
   * Prettier's `printWidth`.
   *
   * @default 80
   */
  printWidth?: number;

  /**
   * Indentation increment in columns. Mirrors Prettier's `tabWidth`.
   *
   * @default 2
   */
  tabWidth?: number;

  /**
   * Emit indentation as tab characters. Mirrors Prettier's `useTabs`.
   *
   * @default false
   */
  useTabs?: boolean;

  /**
   * Line terminator the printer emits on reflow. `@ttsc/lint` supports `"lf"`
   * and `"crlf"`. Prettier's `"cr"` and `"auto"` are intentionally unsupported
   * because the printer does not auto-detect line endings.
   *
   * @default "lf"
   */
  endOfLine?: "lf" | "crlf";

  /**
   * Import sorting & merging. Off unless present; `true` enables it with
   * defaults, an object customizes.
   *
   * @default false
   */
  sortImports?: boolean | ITtscLintFormatSortImports;

  /**
   * JSDoc tag normalization. On by default like the rest of the format set;
   * pass `false` to disable, or an object to customize.
   *
   * Today it only rewrites tag synonyms (`@return` → `@returns`, `@arg` →
   * `@param`, ...); tag sorting, `@param` column alignment, and description
   * wrapping are on the roadmap.
   *
   * @default true
   */
  jsDoc?: boolean | ITtscLintFormatJsDoc;
}
