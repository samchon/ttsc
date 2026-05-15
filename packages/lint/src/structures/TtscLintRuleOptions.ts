/**
 * Per-rule option shapes used by `TtscLintRuleEntry` to type the second tuple
 * slot.
 *
 * Each entry here maps a rule name to its option struct. Rule names that do not
 * appear in this interface accept severity-only configuration (a `[severity]`
 * tuple is _also_ allowed for them, with an empty options blob).
 *
 * The shapes are designed to match the analogous prettier / ESLint options
 * where the rule absorbs an existing tool's behavior:
 *
 * - `format/semi` mirrors prettier `semi`.
 * - `format/quotes` mirrors prettier `singleQuote` (inverted).
 * - `format/trailing-comma` mirrors prettier `trailingComma`.
 * - `format/sort-imports` mirrors `@trivago/prettier-plugin-sort-imports`
 *   (`importOrder`, `importOrderSeparation`, `importOrderSortSpecifiers`,
 *   `importOrderCaseInsensitive`).
 * - `format/jsdoc` mirrors `prettier-plugin-jsdoc` (`tagSynonyms` layered onto
 *   the built-in synonym table, `sortTags` reserved for a future pass).
 *
 * Future option additions go here so the TypeScript autocomplete updates in one
 * place. The Go side reads these as `json.RawMessage` and each rule decodes
 * into its own struct.
 */
export namespace TtscLintRuleOptions {
  /** `format/semi` options. */
  export interface Semi {
    /**
     * Whether trailing semicolons must be present on ASI statements.
     *
     * @default "always"
     */
    prefer?: "always" | "never";
  }

  /** `format/quotes` options. */
  export interface Quotes {
    /**
     * Quote style for string literals. Template literals are always preserved
     * regardless of this setting.
     *
     * @default "double"
     */
    prefer?: "double" | "single";
  }

  /** `format/trailing-comma` options. */
  export interface TrailingComma {
    /**
     * Which multi-line lists receive a trailing comma. `"all"` matches
     * prettier's modern default; `"es5"` skips function calls and type
     * parameter lists; `"none"` disables the rule entirely.
     *
     * @default "all"
     */
    mode?: "all" | "es5" | "none";
  }

  /** `format/sort-imports` options. */
  export interface SortImports {
    /**
     * Ordered list of regex strings (or the `<THIRD_PARTY_MODULES>`
     * placeholder) defining the group order. Imports matching the first pattern
     * land in group 0, the second in group 1, and so on. The placeholder
     * absorbs any specifier that does not match another pattern. Mirrors
     * trivago's `importOrder` semantics.
     */
    importOrder?: readonly string[];

    /**
     * Insert a blank line between groups.
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
     * Treat `A` and `a` as equivalent when comparing module specifiers and
     * specifier names. Mirrors trivago's `importOrderCaseInsensitive`.
     *
     * @default false
     */
    importOrderCaseInsensitive?: boolean;
  }

  /** `format/print-width` options. */
  export interface PrintWidth {
    /**
     * Maximum column width before broken-form layout is chosen. Mirrors
     * prettier's `printWidth`.
     *
     * @default 80
     */
    printWidth?: number;

    /**
     * Indentation increment in columns. Mirrors prettier's `tabWidth`.
     *
     * @default 2
     */
    tabWidth?: number;

    /**
     * Emit indentation as tab characters rather than spaces. Mirrors
     * prettier's `useTabs`. Continuation alignment beyond the tab
     * boundary still falls back to spaces, matching dprint's
     * "indent with tabs, align with spaces" convention.
     *
     * @default false
     */
    useTabs?: boolean;

    /**
     * Line-terminator emitted on every newline the printer inserts.
     * Mirrors prettier's `endOfLine` `"lf"` and `"crlf"` modes.
     *
     * @default "lf"
     */
    endOfLine?: "lf" | "crlf";
  }

  /** `format/jsdoc` options. */
  export interface JSDoc {
    /**
     * Extra `from → to` tag rewrites layered on top of the built-in synonym
     * table (`@return → @returns`, `@arg → @param`, etc.). User-supplied
     * entries win on key collision, so a `{"return": "RETURN"}` entry overrides
     * the built-in default for `@return`.
     *
     * @default {} (use built-in table unchanged)
     */
    tagSynonyms?: Record<string, string>;

    /**
     * Sort JSDoc tag blocks into the canonical order (`@description`, `@param`,
     * `@returns`, …).
     *
     * @default false (deferred; MVP only normalizes tag names)
     */
    sortTags?: boolean;
  }
}

/**
 * Index from rule name to its option struct. Used by `TtscLintRuleEntry<R>` to
 * produce precise tuple types per rule.
 */
export interface TtscLintRuleOptionsMap {
  "format/semi": TtscLintRuleOptions.Semi;
  "format/quotes": TtscLintRuleOptions.Quotes;
  "format/trailing-comma": TtscLintRuleOptions.TrailingComma;
  "format/sort-imports": TtscLintRuleOptions.SortImports;
  "format/jsdoc": TtscLintRuleOptions.JSDoc;
  "format/print-width": TtscLintRuleOptions.PrintWidth;
}
