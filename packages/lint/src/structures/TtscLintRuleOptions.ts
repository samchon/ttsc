/** `format/semi` rule options. */
export interface ITtscLintSemiRuleOptions {
  /**
   * Whether trailing semicolons must be present on ASI statements.
   *
   * @default "always"
   */
  prefer?: "always" | "never";
}

/** `format/quotes` rule options. */
export interface ITtscLintQuotesRuleOptions {
  /**
   * Quote style for string literals. Template literals are always preserved
   * regardless of this setting.
   *
   * @default "double"
   */
  prefer?: "double" | "single";
}

/** `format/trailing-comma` rule options. */
export interface ITtscLintTrailingCommaRuleOptions {
  /**
   * Which multi-line lists receive a trailing comma. `"all"` matches prettier's
   * modern default; `"es5"` skips function calls and type parameter lists;
   * `"none"` disables the rule entirely.
   *
   * @default "all"
   */
  mode?: "all" | "es5" | "none";
}

/** `format/sort-imports` rule options. */
export interface ITtscLintSortImportsRuleOptions {
  /**
   * Ordered list of regex strings (or the `<THIRD_PARTY_MODULES>` placeholder)
   * defining the group order. Imports matching the first pattern land in group
   * 0, the second in group 1, and so on. The placeholder absorbs any specifier
   * that does not match another pattern. Mirrors trivago's `importOrder`
   * semantics.
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

/** `format/print-width` rule options. */
export interface ITtscLintPrintWidthRuleOptions {
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
   * Emit indentation as tab characters rather than spaces. Mirrors prettier's
   * `useTabs`. Continuation alignment beyond the tab boundary still falls back
   * to spaces, matching dprint's "indent with tabs, align with spaces"
   * convention.
   *
   * @default false
   */
  useTabs?: boolean;

  /**
   * Line-terminator emitted on every newline the printer inserts. Mirrors
   * prettier's `endOfLine` `"lf"` and `"crlf"` modes.
   *
   * @default "lf"
   */
  endOfLine?: "lf" | "crlf";

  /**
   * Trailing-comma policy the reflow honors when it breaks a list across
   * lines. Mirrors prettier's `trailingComma` and must match the
   * `format/trailing-comma` rule's `mode`; otherwise the two rules
   * disagree on every cascade pass and oscillate against each other.
   *
   * When a `format` block is configured, `format.trailingComma` is mirrored
   * into this option automatically. Set it directly only when overriding
   * the print-width rule via a `rules` tuple — see the conflict-resolution
   * notes in the README.
   *
   * @default "all"
   */
  trailingComma?: "all" | "es5" | "none";
}

/** `format/jsdoc` rule options. */
export interface ITtscLintJsdocRuleOptions {
  /**
   * Extra `from -> to` tag rewrites layered on top of the built-in synonym
   * table (`@return -> @returns`, `@arg -> @param`, etc.). User-supplied
   * entries win on key collision, so a `{"return": "RETURN"}` entry overrides
   * the built-in default for `@return`.
   *
   * @default {} (use built-in table unchanged)
   */
  tagSynonyms?: Record<string, string>;

  /**
   * Sort JSDoc tag blocks into the canonical order (`@description`, `@param`,
   * `@returns`, ...).
   *
   * @default false (deferred; MVP only normalizes tag names)
   */
  sortTags?: boolean;
}

/** `react-perf/*` rule options. */
export interface ITtscLintReactPerfRuleOptions {
  /**
   * Controls which intrinsic JSX element props are ignored.
   *
   * `"all"` ignores every prop on lowercase/native elements such as `div`.
   * An array ignores only those prop names on native elements, for example
   * `["style"]`. Custom components are still checked.
   *
   * @default [] (native props are checked)
   */
  nativeAllowList?: "all" | readonly string[];
}

/** `storybook/no-uninstalled-addons` rule options. */
export interface ITtscLintStorybookNoUninstalledAddonsRuleOptions {
  /**
   * Explicit package.json path used to validate configured Storybook addons.
   * When omitted, the rule walks upward from the linted config file.
   */
  packageJsonLocation?: string;

  /**
   * Addon package names to skip when checking installation status.
   *
   * @default []
   */
  ignore?: readonly string[];
}

/** Shared pattern option accepted by several `functional/*` rules. */
export interface ITtscLintFunctionalPatternOptions {
  /** Identifier regex string(s) the rule should skip. */
  ignoreIdentifierPattern?: string | readonly string[];

  /** Source-code regex string(s) the rule should skip. */
  ignoreCodePattern?: string | readonly string[];
}

/** `functional/functional-parameters` rule options. */
export interface ITtscLintFunctionalParametersRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Allow rest parameters such as `(...args: readonly string[])`. */
  allowRestParameter?: boolean;

  /** Allow the legacy `arguments` object. */
  allowArgumentsKeyword?: boolean;

  /**
   * Require functions to declare parameters. `true` maps to the conservative
   * at-least-one policy.
   */
  enforceParameterCount?: boolean | "atLeastOne" | "exactlyOne";
}

/** `functional/immutable-data` rule options. */
export interface ITtscLintFunctionalImmutableDataRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Skip mutating `Map` and `Set` methods while still checking arrays/properties. */
  ignoreMapsAndSets?: boolean;
}

/** `functional/no-let` rule options. */
export interface ITtscLintFunctionalNoLetRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Permit `let` in a `for` statement initializer. */
  allowInForLoopInit?: boolean;

  /** Permit `let` inside functions while still rejecting module-level `let`. */
  allowInFunctions?: boolean;
}

/** `functional/no-conditional-statements` rule options. */
export interface ITtscLintFunctionalNoConditionalStatementsRuleOptions {
  /** Reserved for upstream-compatible configs; current native rule rejects all `if`/`switch` statements. */
  allowReturningBranches?: boolean | "ifExhaustive";
}

/** `functional/no-try-statements` rule options. */
export interface ITtscLintFunctionalNoTryStatementsRuleOptions {
  /** Allow `try/catch` while still checking `finally` when present. */
  allowCatch?: boolean;

  /** Allow `try/finally` while still checking `catch` when present. */
  allowFinally?: boolean;
}

/** `functional/no-throw-statements` rule options. */
export interface ITtscLintFunctionalNoThrowStatementsRuleOptions {
  /** Reserved for upstream-compatible configs; current native rule rejects all `throw` statements. */
  allowToRejectPromises?: boolean;
}

/** `functional/no-mixed-types` rule options. */
export interface ITtscLintFunctionalNoMixedTypesRuleOptions {
  /** Check interface member kinds. */
  checkInterfaces?: boolean;

  /** Check type-literal member kinds. */
  checkTypeLiterals?: boolean;
}

/** `functional/no-return-void` rule options. */
export interface ITtscLintFunctionalNoReturnVoidRuleOptions {
  allowNull?: boolean;
  allowUndefined?: boolean;
  ignoreInferredTypes?: boolean;
}

/** `functional/prefer-immutable-types` rule options. */
export interface ITtscLintFunctionalPreferImmutableTypesRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Minimum accepted immutability. The native subset treats any configured value as readonly-required. */
  enforcement?: "ReadonlyShallow" | "ReadonlyDeep" | "Immutable" | "None" | false;
}

/** `functional/prefer-readonly-type` rule options. */
export interface ITtscLintFunctionalPreferReadonlyTypeRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  allowLocalMutation?: boolean;
  allowMutableReturnType?: boolean;
  checkImplicit?: boolean;
  ignoreCollections?: boolean;
  ignoreClass?: boolean | "fieldsOnly";
  ignoreInterface?: boolean;
}

/** `functional/prefer-tacit` rule options. */
export interface ITtscLintFunctionalPreferTacitRuleOptions {
  /** Check member expressions such as `x => service.map(x)`. */
  checkMemberExpressions?: boolean;
}

/** `functional/readonly-type` rule options. */
export interface ITtscLintFunctionalReadonlyTypeRuleOptions {
  /**
   * Preferred readonly spelling.
   *
   * @default "keyword"
   */
  prefer?: "keyword" | "generic";
}

/** `functional/type-declaration-immutability` declaration policy. */
export interface ITtscLintFunctionalTypeDeclarationImmutabilityRule {
  /** Type/interface name or regex string(s) this policy applies to. */
  identifiers: string | readonly string[];

  /** Reserved for upstream-compatible configs; current native subset treats all values as readonly-required. */
  immutability?: "ReadonlyShallow" | "ReadonlyDeep" | "Immutable" | "Mutable";

  comparator?: "Less" | "AtMost" | "Exactly" | "AtLeast" | "More" | -2 | -1 | 0 | 1 | 2;
}

/** `functional/type-declaration-immutability` rule options. */
export interface ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Optional declaration-name policies. Empty means all type declarations. */
  rules?: readonly ITtscLintFunctionalTypeDeclarationImmutabilityRule[];

  /** Skip interface declarations and only check type aliases. */
  ignoreInterfaces?: boolean;
}

/** Empty object options accepted by simple `functional/*` policy rules. */
export interface ITtscLintFunctionalEmptyRuleOptions {}
/** `cypress/unsafe-to-chain-command` rule options. */
export interface ITtscLintCypressUnsafeToChainCommandRuleOptions {
  /**
   * Additional Cypress command names that should be treated as unsafe action
   * commands when another command is chained after them.
   *
   * @default []
   */
  methods?: readonly string[];
}

/** One source-path element used by the `boundaries/*` rules. */
export interface ITtscLintBoundariesElement {
  /** Element type name used by `boundaries/element-types` policies. */
  type: string;

  /**
   * Glob-like source path pattern. Relative patterns are matched against any
   * project-path suffix, so `src/app/**` works in temporary and monorepo roots.
   */
  pattern: string;

  /**
   * File(s) inside the element that may be imported from outside that element.
   * Used by `boundaries/entry-point`.
   */
  entry?: string | readonly string[];

  /**
   * File(s) inside the element that may only be imported by the same element.
   * Used by `boundaries/no-private`.
   */
  private?: string | readonly string[];
}

/** Dependency policy used by `boundaries/element-types`. */
export interface ITtscLintBoundariesElementTypesRule {
  /** Source element type(s) the policy applies to. Omit to match all sources. */
  from?: string | readonly string[];

  /** Target element type(s) allowed from the matching source. */
  allow?: string | readonly string[];

  /** Target element type(s) rejected from the matching source. */
  disallow?: string | readonly string[];

  /** Optional diagnostic override. */
  message?: string;
}

/** Shared element declaration block used by TypeScript source-path rules. */
export interface ITtscLintBoundariesElementsOptions {
  /** Source path elements used to classify importers and imported files. */
  elements?: readonly ITtscLintBoundariesElement[];
}

/** `boundaries/element-types` rule options. */
export interface ITtscLintBoundariesElementTypesRuleOptions
  extends ITtscLintBoundariesElementsOptions {
  /**
   * Fallback policy when no rule matches.
   *
   * @default "allow"
   */
  default?: "allow" | "disallow";

  /** Ordered dependency policies. First matching policy wins. */
  rules?: readonly ITtscLintBoundariesElementTypesRule[];
}

/** `boundaries/external` rule options. */
export interface ITtscLintBoundariesExternalRuleOptions {
  /** External package/specifier patterns that are allowed. Empty means all. */
  allow?: string | readonly string[];

  /** External package/specifier patterns that are rejected. */
  disallow?: string | readonly string[];

  /** Optional diagnostic override. */
  message?: string;
}

/** `boundaries/entry-point` rule options. */
export type ITtscLintBoundariesEntryPointRuleOptions =
  ITtscLintBoundariesElementsOptions;

/** `boundaries/no-private` rule options. */
export type ITtscLintBoundariesNoPrivateRuleOptions =
  ITtscLintBoundariesElementsOptions;

/** `boundaries/no-unknown` rule options. */
export type ITtscLintBoundariesNoUnknownRuleOptions =
  ITtscLintBoundariesElementsOptions;

/** `eslint-comments/disable-enable-pair` rule options. */
export interface ITtscLintDisableEnablePairRuleOptions {
  /**
   * Allow a file-leading range disable to stay open through the end of the file.
   *
   * @default false
   */
  allowWholeFile?: boolean;
}

/** `eslint-comments/no-restricted-disable` rule options. */
export interface ITtscLintNoRestrictedDisableRuleOptions {
  /** Rule names that inline disable comments may not suppress. */
  rules?: readonly string[];
}

/** `eslint-comments/no-use` rule options. */
export interface ITtscLintNoUseRuleOptions {
  /**
   * Directive markers that remain allowed, such as `"eslint-disable-next-line"`.
   *
   * @default []
   */
  allow?: readonly string[];
}

/** `react-refresh/only-export-components` rule options. */
export interface ITtscLintReactRefreshOnlyExportComponentsRuleOptions {
  /**
   * Extra higher-order component names that wrap component exports.
   *
   * @default []
   */
  extraHOCs?: readonly string[];

  /**
   * Export names the active framework handles during refresh, such as route
   * metadata exports.
   *
   * @default []
   */
  allowExportNames?: readonly string[];

  /**
   * Permit literal/string/boolean/template/binary constant exports alongside
   * component exports.
   *
   * @default false
   */
  allowConstantExport?: boolean;

  /**
   * Also scan JavaScript files that import React. TSX files are always scanned.
   *
   * @default false
   */
  checkJS?: boolean;
}

/** `testing-library/consistent-data-testid` rule options.
 */
export interface ITtscLintTestingLibraryConsistentDataTestIdRuleOptions {
  /**
   * Regular expression string every configured test-id attribute value must
   * match. `{fileName}` is replaced with the basename before the first dot.
   */
  testIdPattern: string;

  /**
   * Test-id attribute name, or names, to validate.
   *
   * @default "data-testid"
   */
  testIdAttribute?: string | readonly string[];
}

/**
 * Index from typed rule name to its option object. Kept as a public lookup
 * type for consumers that want to derive option helpers from the same rule
 * names accepted by `ITtscLintRules`.
 */
export interface ITtscLintRuleOptionsMap {
  "testing-library/consistent-data-testid": ITtscLintTestingLibraryConsistentDataTestIdRuleOptions;
  "functional/functional-parameters": ITtscLintFunctionalParametersRuleOptions;
  "functional/immutable-data": ITtscLintFunctionalImmutableDataRuleOptions;
  "functional/no-class-inheritance": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-classes": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-conditional-statements": ITtscLintFunctionalNoConditionalStatementsRuleOptions;
  "functional/no-expression-statements": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-let": ITtscLintFunctionalNoLetRuleOptions;
  "functional/no-loop-statements": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-mixed-types": ITtscLintFunctionalNoMixedTypesRuleOptions;
  "functional/no-promise-reject": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-return-void": ITtscLintFunctionalNoReturnVoidRuleOptions;
  "functional/no-this-expressions": ITtscLintFunctionalEmptyRuleOptions;
  "functional/no-throw-statements": ITtscLintFunctionalNoThrowStatementsRuleOptions;
  "functional/no-try-statements": ITtscLintFunctionalNoTryStatementsRuleOptions;
  "functional/prefer-immutable-types": ITtscLintFunctionalPreferImmutableTypesRuleOptions;
  "functional/prefer-property-signatures": ITtscLintFunctionalEmptyRuleOptions;
  "functional/prefer-readonly-type": ITtscLintFunctionalPreferReadonlyTypeRuleOptions;
  "functional/prefer-tacit": ITtscLintFunctionalPreferTacitRuleOptions;
  "functional/readonly-type": ITtscLintFunctionalReadonlyTypeRuleOptions;
  "functional/type-declaration-immutability": ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions;
  "cypress/unsafe-to-chain-command": ITtscLintCypressUnsafeToChainCommandRuleOptions;
  "boundaries/element-types": ITtscLintBoundariesElementTypesRuleOptions;
  "boundaries/entry-point": ITtscLintBoundariesEntryPointRuleOptions;
  "boundaries/external": ITtscLintBoundariesExternalRuleOptions;
  "boundaries/no-private": ITtscLintBoundariesNoPrivateRuleOptions;
  "boundaries/no-unknown": ITtscLintBoundariesNoUnknownRuleOptions;
  "eslint-comments/disable-enable-pair": ITtscLintDisableEnablePairRuleOptions;
  "eslint-comments/no-restricted-disable": ITtscLintNoRestrictedDisableRuleOptions;
  "eslint-comments/no-use": ITtscLintNoUseRuleOptions;
  "format/semi": ITtscLintSemiRuleOptions;
  "format/quotes": ITtscLintQuotesRuleOptions;
  "format/trailing-comma": ITtscLintTrailingCommaRuleOptions;
  "format/sort-imports": ITtscLintSortImportsRuleOptions;
  "format/jsdoc": ITtscLintJsdocRuleOptions;
  "format/print-width": ITtscLintPrintWidthRuleOptions;
  "react-perf/jsx-no-new-array-as-prop": ITtscLintReactPerfRuleOptions;
  "react-perf/jsx-no-new-function-as-prop": ITtscLintReactPerfRuleOptions;
  "react-perf/jsx-no-new-object-as-prop": ITtscLintReactPerfRuleOptions;
  "react-perf/jsx-no-jsx-as-prop": ITtscLintReactPerfRuleOptions;
  "storybook/no-uninstalled-addons": ITtscLintStorybookNoUninstalledAddonsRuleOptions;
  "react-refresh/only-export-components": ITtscLintReactRefreshOnlyExportComponentsRuleOptions;
}
