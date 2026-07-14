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

/**
 * Per-module style policy for `unicorn/import-style`.
 *
 * `false` removes every restriction from the module. An object maps style names
 * (`unassigned`, `default`, `namespace`, `named`) to booleans; with
 * `extendDefaultStyles` the flags merge over the module's built-in entry. A
 * module whose four canonical styles are all explicitly `false` is reported as
 * misconfigured on every reference — use `no-restricted-imports` to ban a
 * module outright.
 */
export type TtscLintUnicornImportStyleModuleStyles =
  | false
  | Readonly<Record<string, boolean>>;

/**
 * Options for `unicorn/import-style`.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/import-style.md
 */
export interface ITtscLintUnicornImportStyleRuleOptions {
  /** Check static `import` declarations. @default true */
  checkImport?: boolean;

  /** Check dynamic `import()` expressions. @default true */
  checkDynamicImport?: boolean;

  /** Check `export … from` declarations. @default false */
  checkExportFrom?: boolean;

  /** Check `require(…)` calls. @default true */
  checkRequire?: boolean;

  /** Merge `styles` into the built-in per-module table. @default true */
  extendDefaultStyles?: boolean;

  /**
   * Allowed import styles per module name. `node:`-prefixed references inherit
   * the bare module name's policy.
   */
  styles?: Readonly<Record<string, TtscLintUnicornImportStyleModuleStyles>>;
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

/** Options for `unicorn/consistent-function-scoping`. */
export interface ITtscLintUnicornConsistentFunctionScopingRuleOptions {
  /** Also check arrow functions for movable definitions. @default true */
  checkArrowFunctions?: boolean;
}

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
