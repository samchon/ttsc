import type { TtscLintSeverity } from "./TtscLintSeverity";

/**
 * Prettier-style flat configuration for the format rules.
 *
 * The `format` block is the recommended way to enable formatting in
 * `@ttsc/lint`. Each key mirrors a Prettier option of the same name — users
 * coming from a `.prettierrc` can copy their config almost verbatim. The block
 * is opt-in by presence: a `lint.config.ts` with no `format` field keeps every
 * format rule off, exactly as before.
 *
 * Once present, the block configures a curated set of format rules at
 * Prettier-aligned defaults. `ttsc format` uses these rules to rewrite source.
 * `ttsc check` does not report format findings unless `severity` is set to a
 * non-off value. Individual rules can be overridden or disabled through the
 * `rules` map (the `rules` entry wins on conflict).
 *
 * @example
 *   import type { ITtscLintConfig } from "@ttsc/lint";
 *
 *   export default {
 *   rules: { "no-var": "error" },
 *   format: {
 *   severity: "warning",
 *   printWidth: 100,
 *   singleQuote: true,
 *   importOrder: ["<THIRD_PARTY_MODULES>", "^[./]"],
 *   },
 *   } satisfies ITtscLintConfig;
 *
 *   Deviations from Prettier:
 *   - `endOfLine` is restricted to `"lf"` and `"crlf"`. Prettier's
 *   `"cr"` and `"auto"` modes are intentionally unsupported — the
 *   printer does not auto-detect terminators.
 *   - Many Prettier knobs (`bracketSpacing`, `arrowParens`,
 *   `quoteProps`, JSX-specific switches) are not yet implemented.
 *
 *   Rule enablement matrix (when the `format` block is present):
 *
 *   - `format/semi` — always on. `semi: false` flips it to `prefer:
 *   "never"`.
 *   - `format/quotes` — always on. `singleQuote: true` flips to
 *   `prefer: "single"`.
 *   - `format/trailing-comma` — always on. `trailingComma: "none"`
 *   disables the rule's edits without removing the surface.
 *   - `format/print-width` — always on, driven by `printWidth`,
 *   `tabWidth`, `useTabs`, `endOfLine`.
 *   - `format/sort-imports` — opt-in. Setting `importOrder` enables it.
 *   - `format/jsdoc` — opt-in. Setting `jsdoc` enables it.
 *
 *   Format findings produced from this block are off by default. Set `severity`
 *   only when a project intentionally wants check-time format diagnostics.
 */
export interface ITtscLintFormatConfig {
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
   * Group order for `format/sort-imports`. Setting this enables the rule;
   * mirrors `@trivago/prettier-plugin-sort-imports`' `importOrder`. The
   * `<THIRD_PARTY_MODULES>` literal is the catch-all placeholder for specifiers
   * that match no other group.
   */
  importOrder?: readonly ("<THIRD_PARTY_MODULES>" | (string & {}))[];

  /**
   * Insert blank line between sort-imports groups.
   *
   * @default true
   */
  importOrderSeparation?: boolean;

  /**
   * Sort named import specifiers alphabetically within each declaration.
   *
   * @default true
   */
  importOrderSortSpecifiers?: boolean;

  /**
   * Case-insensitive comparison for sort-imports.
   *
   * @default false
   */
  importOrderCaseInsensitive?: boolean;

  /**
   * Enable `format/jsdoc`. Pass `true` to turn it on with built-in defaults, or
   * an object to customize:
   *
   * - `tagSynonyms` — extra `from → to` rewrites layered on the built-in synonym
   *   table.
   * - `sortTags` — sort JSDoc tags into canonical order (reserved; today's MVP
   *   only rewrites tag names).
   *
   * @default false (off)
   */
  jsdoc?:
    | boolean
    | {
        tagSynonyms?: Record<string, string>;
        sortTags?: boolean;
      };
}
