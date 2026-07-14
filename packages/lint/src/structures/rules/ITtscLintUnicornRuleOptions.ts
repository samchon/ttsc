/**
 * Options for `unicorn/template-indent`.
 *
 * Each selection list replaces the corresponding default list. `indent` is
 * either a positive number of spaces or the exact non-empty whitespace string
 * added after the opening template's source-line margin.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/template-indent.md
 */
export interface ITtscLintUnicornTemplateIndentRuleOptions {
  /** Block-comment contents that select the immediately following template. */
  comments?: readonly string[];

  /** Function paths whose direct template-literal arguments are checked. */
  functions?: readonly string[];

  /** Positive space count or exact whitespace unit used inside the template. */
  indent?: number | string;

  /** AST selectors whose matching template literals are checked. */
  selectors?: readonly string[];

  /** Identifier or dotted member paths used as checked template tags. */
  tags?: readonly string[];
}

/** Import categories accepted by `unicorn/prevent-abbreviations`. */
export type TtscLintUnicornPreventAbbreviationsImportMode =
  | boolean
  | "internal";

/**
 * Replacement patch for one discouraged name.
 *
 * `false` disables every replacement for the name. An object enables or
 * disables individual replacement spellings.
 */
export type TtscLintUnicornPreventAbbreviationsReplacement =
  | false
  | Readonly<Record<string, boolean>>;

/** Options for `unicorn/prevent-abbreviations`. */
export interface ITtscLintUnicornPreventAbbreviationsRuleOptions {
  /** Also check property definitions and writes. @default false */
  checkProperties?: boolean;

  /** Check lexical bindings. @default true */
  checkVariables?: boolean;

  /**
   * Check default and namespace imports from all modules, internal modules, or
   * no modules.
   *
   * @default "internal"
   */
  checkDefaultAndNamespaceImports?: TtscLintUnicornPreventAbbreviationsImportMode;

  /**
   * Check unaliased named imports from all modules, internal modules, or no
   * modules.
   *
   * @default "internal"
   */
  checkShorthandImports?: TtscLintUnicornPreventAbbreviationsImportMode;

  /** Check bindings introduced by shorthand object destructuring. @default false */
  checkShorthandProperties?: boolean;

  /** Check the physical source filename. @default true */
  checkFilenames?: boolean;

  /** Merge `replacements` into the canonical default table. @default true */
  extendDefaultReplacements?: boolean;

  /** Add, remove, or replace discouraged-name mappings. */
  replacements?: Readonly<
    Record<string, TtscLintUnicornPreventAbbreviationsReplacement>
  >;

  /** Merge `allowList` into the canonical default allow list. @default true */
  extendDefaultAllowList?: boolean;

  /** Case-sensitive full names to allow or remove from the allow list. */
  allowList?: Readonly<Record<string, boolean>>;

  /** Regular-expression strings matched against a complete name or basename. */
  ignore?: readonly string[];
}
