/**
 * Case-style keys accepted by `unicorn/filename-case`.
 *
 * @evidence contracts/common.md#principled-implementation The five literals are the style names recognized by the native filename decoder.
 * @evidence contracts/common.md#clear-and-simple-design One union identifies styles in both single-style and allowed-style configurations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts These literals express supported styles rather than filenames exempted for known consumers.
 * @evidence contracts/common.md#meaningful-documentation The owning comment identifies the consuming rule and the literals name its available styles.
 */
export type TtscLintUnicornFilenameCaseName =
  | "camelCase"
  | "camelCaseWithAcronyms"
  | "kebabCase"
  | "snakeCase"
  | "pascalCase";

/**
 * Options for `unicorn/filename-case`.
 *
 * `case` and `cases` are mutually exclusive: configure either the single
 * enforced style or a map of allowed styles. With neither configured, or with
 * every `cases` entry disabled, the rule enforces kebab-case.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/filename-case.md
 * @evidence contracts/common.md#principled-implementation The exclusive union prevents simultaneous case and cases settings, which the native decoder rejects; shared members describe path selection and extension handling.
 * @evidence contracts/common.md#clear-and-simple-design Shared scanning options are declared once and intersected with the two style-selection alternatives.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ignore patterns are caller-declared path policies; kebab-case is the rule default rather than a consumer-specific exception.
 * @evidence contracts/common.md#meaningful-documentation The prose explains exclusive style selection and fallback behavior; members document path matching and extension semantics with separated defaults.
 */
export type ITtscLintUnicornFilenameCaseRuleOptions = {
  /**
   * Go regular-expression strings; a file is exempt when any pattern matches a
   * segment of its project-relative path. Files outside the project directory
   * contribute only their basename.
   */
  ignore?: readonly string[];

  /**
   * Treat additional dot-separated parts of a filename as file extensions,
   * checking only the stem before the first dot.
   *
   * @default true
   */
  multipleFileExtensions?: boolean;

  /**
   * Check directory names.
   *
   * @default true
   */
  checkDirectories?: boolean;
} & (
  | {
      /** The single filename and directory name case style. */
      case?: TtscLintUnicornFilenameCaseName;

      /** A style map cannot accompany a single style. */
      cases?: never;
    }
  | {
      /** A single style cannot accompany a style map. */
      case?: never;

      /** The allowed filename and directory name case styles. */
      cases?: Partial<
        Readonly<Record<TtscLintUnicornFilenameCaseName, boolean>>
      >;
    }
);

/**
 * Options for `unicorn/better-regex`.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/better-regex.md
 * @evidence contracts/common.md#principled-implementation The optional boolean controls range reordering independently of length-reducing regex shorthand transformations.
 * @evidence contracts/common.md#clear-and-simple-design One switch exposes the only configurable transformation policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The switch selects a general regex policy without naming particular expressions or fixtures.
 * @evidence contracts/common.md#meaningful-documentation The member explains the default, the single disabled literal transform and an example of adjacent-range merging.
 */
export interface ITtscLintUnicornBetterRegexRuleOptions {
  /**
   * Sort and merge adjacent character-class ranges in regex literals (e.g.
   * `[d-ea-c]` -> `[a-e]`). Defaults to `true`; set `false` to disable this
   * range-sorting and merging transform while retaining the other regex
   * optimizations.
   */
  sortCharacterClasses?: boolean;
}

/**
 * Options for `unicorn/template-indent`.
 *
 * Each selection list replaces the corresponding default list. `indent` is
 * either a positive integer number of spaces or the exact non-empty whitespace
 * string added after the opening template's source-line margin.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/template-indent.md
 * @evidence contracts/common.md#principled-implementation Selection lists identify template contexts and indentation represents a positive space count or exact whitespace unit; runtime validation rejects invalid units.
 * @evidence contracts/common.md#clear-and-simple-design The four selection lists and indentation unit stay in the owning template rule's option object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Caller selectors replace documented defaults instead of matching specific consumer templates in production code.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes replacement from merging and defines indentation relative to the opening source margin.
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
 *
 * @evidence contracts/common.md#principled-implementation False disables a module policy and a boolean map patches style permissions; arbitrary keys remain accepted by the native ordered-boolean decoder.
 * @evidence contracts/common.md#clear-and-simple-design A disable alternative and one map capture per-module policy separately from the enclosing merge settings.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Restrictions are explicit module policy data; disabling all canonical styles is documented as misconfiguration.
 * @evidence contracts/common.md#meaningful-documentation The prose identifies canonical styles, default merging and the distinct rule needed to ban modules.
 */
export type TtscLintUnicornImportStyleModuleStyles =
  | false
  | Readonly<Record<string, boolean>>;

/**
 * Options for `unicorn/import-style`.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/import-style.md
 * @evidence contracts/common.md#principled-implementation Independent syntax-kind flags select module references and a per-module style map determines their permitted import forms.
 * @evidence contracts/common.md#clear-and-simple-design Syntax selection, table merging and module entries are separate members of the owning import policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Module entries are caller configuration and node-prefixed inheritance follows module policy rather than patches to consumers.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish static, dynamic, re-export and require checks and explain merging and node-prefix inheritance.
 */
export interface ITtscLintUnicornImportStyleRuleOptions {
  /**
   * Check static `import` declarations.
   *
   * @default true
   */
  checkImport?: boolean;

  /**
   * Check dynamic `import()` expressions.
   *
   * @default true
   */
  checkDynamicImport?: boolean;

  /**
   * Check `export ... from` declarations.
   *
   * @default false
   */
  checkExportFrom?: boolean;

  /**
   * Check `require(...)` calls.
   *
   * @default true
   */
  checkRequire?: boolean;

  /**
   * Merge `styles` into the built-in per-module table.
   *
   * @default true
   */
  extendDefaultStyles?: boolean;

  /**
   * Allowed import styles per module name. `node:`-prefixed references inherit
   * the bare module name's policy.
   */
  styles?: Readonly<Record<string, TtscLintUnicornImportStyleModuleStyles>>;
}

/**
 * Global-variable policy for one `unicorn/isolated-functions` override.
 *
 * `true` / `"writable"` / `"writeable"` permit writes, `false` / `"readonly"`
 * permit reads only, and `"off"` forbids the global entirely inside isolated
 * scopes.
 *
 * @evidence contracts/common.md#principled-implementation Boolean and named aliases represent writable, readonly or unavailable globals as categorized by the native override decoder.
 * @evidence contracts/common.md#clear-and-simple-design One value union serves each global name without embedding name lookup or scope traversal in options.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Writable and writeable are supported spelling aliases, not mutations of external global bindings.
 * @evidence contracts/common.md#meaningful-documentation The prose maps every spelling and boolean to read, write or prohibition semantics.
 */
export type TtscLintUnicornIsolatedFunctionsGlobalPolicy =
  | boolean
  | "readonly"
  | "writable"
  | "writeable"
  | "off";

/**
 * Options for `unicorn/isolated-functions`.
 *
 * Each list replaces the corresponding default. A function is treated as
 * isolated when a call to a name in `functions` receives it as an argument,
 * when it matches one of the `selectors`, or when one of the `comments` markers
 * precedes it; `overrideGlobals` retunes which global names may be read or
 * written inside isolated scopes.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/isolated-functions.md
 * @evidence contracts/common.md#principled-implementation Calls, AST selectors and preceding markers select isolated scopes; per-name policies configure permitted globals within them.
 * @evidence contracts/common.md#clear-and-simple-design Scope selection and global permissions remain separate members in one isolation configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exceptions are declared global policies rather than mutations of JavaScript globals or hardcoded callers.
 * @evidence contracts/common.md#meaningful-documentation The prose explains how selection channels combine and replace defaults; members distinguish markers, callees, selectors and permissions.
 */
export interface ITtscLintUnicornIsolatedFunctionsRuleOptions {
  /**
   * Callee names whose call arguments are isolated functions.
   *
   * @default ["makeSynchronous", "workerize"]
   */
  functions?: readonly string[];

  /**
   * AST selectors whose matching functions are isolated.
   *
   * @default [ ]
   */
  selectors?: readonly string[];

  /**
   * Comment markers that isolate the function they immediately precede.
   *
   * @default ["@isolated"]
   */
  comments?: readonly string[];

  /**
   * Per-name overrides for which globals may be read or written inside isolated
   * scopes.
   */
  overrideGlobals?: Readonly<
    Record<string, TtscLintUnicornIsolatedFunctionsGlobalPolicy>
  >;
}

/**
 * Import categories accepted by `unicorn/prevent-abbreviations`.
 *
 * @evidence contracts/common.md#principled-implementation True and false select all or no imports while internal selects internal modules, matching the native import-mode categories.
 * @evidence contracts/common.md#clear-and-simple-design One scalar union serves both default/namespace and shorthand import switches.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Internal expresses a module category rather than a list of privileged consumers.
 * @evidence contracts/common.md#meaningful-documentation The owning rule is identified here and consuming member comments describe the three categories.
 */
export type TtscLintUnicornPreventAbbreviationsImportMode =
  | boolean
  | "internal";

/**
 * Replacement patch for one discouraged name.
 *
 * `false` disables every replacement for the name. An object enables or
 * disables individual replacement spellings.
 *
 * @evidence contracts/common.md#principled-implementation False disables a discouraged-name entry and prevents alternate-case fallback; a boolean map toggles its candidate expansions.
 * @evidence contracts/common.md#clear-and-simple-design The value type separates one name's replacement policy from the outer name-to-policy table.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Replacement spellings are configurable data rather than built-in exceptions for known source identifiers.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes disabling an entire entry from toggling individual expansions.
 */
export type TtscLintUnicornPreventAbbreviationsReplacement =
  | false
  | Readonly<Record<string, boolean>>;

/**
 * Options for `unicorn/consistent-function-scoping`.
 *
 * @evidence contracts/common.md#principled-implementation The boolean chooses whether arrow functions participate in movable-definition analysis.
 * @evidence contracts/common.md#clear-and-simple-design One optional switch exposes the configurable function category.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The switch applies to a syntax category rather than exempting specific declarations.
 * @evidence contracts/common.md#meaningful-documentation The member states the analysis purpose and default with separated prose and tags.
 */
export interface ITtscLintUnicornConsistentFunctionScopingRuleOptions {
  /**
   * Also check arrow functions for movable definitions.
   *
   * @default true
   */
  checkArrowFunctions?: boolean;
}

/**
 * Options for `unicorn/prevent-abbreviations`.
 *
 * @evidence contracts/common.md#principled-implementation Source-category switches select names while replacement and allow-list maps configure accepted vocabulary.
 * @evidence contracts/common.md#clear-and-simple-design Selection, vocabulary patches and default merging are direct members rather than separate wrapper configurations.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Ignore patterns and naming tables are declared policies without special handling for fixtures or consumers.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish naming contexts, internal-only import defaults and merging behavior.
 */
export interface ITtscLintUnicornPreventAbbreviationsRuleOptions {
  /**
   * Also check property definitions and writes.
   *
   * @default false
   */
  checkProperties?: boolean;

  /**
   * Check lexical bindings.
   *
   * @default true
   */
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

  /**
   * Check bindings introduced by shorthand object destructuring.
   *
   * @default false
   */
  checkShorthandProperties?: boolean;

  /**
   * Check the physical source filename.
   *
   * @default true
   */
  checkFilenames?: boolean;

  /**
   * Merge `replacements` into the canonical default table.
   *
   * @default true
   */
  extendDefaultReplacements?: boolean;

  /** Add, remove, or replace discouraged-name mappings. */
  replacements?: Readonly<
    Record<string, TtscLintUnicornPreventAbbreviationsReplacement>
  >;

  /**
   * Merge `allowList` into the canonical default allow list.
   *
   * @default true
   */
  extendDefaultAllowList?: boolean;

  /** Case-sensitive full names to allow or remove from the allow list. */
  allowList?: Readonly<Record<string, boolean>>;

  /** Regular-expression strings matched against a complete name or basename. */
  ignore?: readonly string[];
}

/**
 * One replacement entry for `unicorn/string-content`.
 *
 * The object form of a `patterns` value. A plain string value is shorthand for
 * `{ suggest: value }`.
 *
 * @evidence contracts/common.md#principled-implementation Required replacement text and independent fix, case and message fields represent the native entry's replacement policy.
 * @evidence contracts/common.md#clear-and-simple-design One entry contains per-pattern settings while the regex source belongs to the outer table key.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Replacement and message templates are caller data rather than corrections hardcoded for known examples.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish editor suggestions from automatic fixes, case sensitivity and message placeholders.
 */
export interface ITtscLintUnicornStringContentPatternOptions {
  /** Replacement text applied to every match of the pattern. */
  suggest: string;

  /**
   * Apply the replacement automatically; `false` reports the diagnostic with an
   * opt-in editor suggestion instead.
   *
   * @default true
   */
  fix?: boolean;

  /**
   * Match the pattern case-sensitively.
   *
   * @default true
   */
  caseSensitive?: boolean;

  /**
   * Custom diagnostic message; `{{match}}` and `{{suggest}}` placeholders
   * interpolate the pattern source and replacement text.
   */
  message?: string;
}

/**
 * Options for `unicorn/string-content`.
 *
 * The rule has no default patterns: without a configured `patterns` object it
 * reports nothing. Each key is a regular-expression source matched against
 * nonempty string-literal values and line-ending-normalized template-quasi raw
 * text; the FIRST matching pattern per eligible node wins and every occurrence
 * is replaced literally. Recognized foreign-language template tags are exempt
 * even when selected explicitly.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/string-content.md
 * @evidence contracts/common.md#principled-implementation Ordered regex keys and replacement entries determine content substitutions; selector overrides choose the inspected AST nodes.
 * @evidence contracts/common.md#clear-and-simple-design Node selection and the pattern table are separate members and detailed replacement entries have their own type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No default patterns invent source-specific replacements; configured entries supply every replacement policy.
 * @evidence contracts/common.md#meaningful-documentation The prose explains empty behavior, literal versus quasi text and first-match ordering for overlapping patterns.
 */
export interface ITtscLintUnicornStringContentRuleOptions {
  /** Regular-expression sources mapped to replacement text or an entry object. */
  patterns?: Readonly<
    Record<string, string | ITtscLintUnicornStringContentPatternOptions>
  >;

  /** AST selectors that replace the default Literal/TemplateElement targets. */
  selectors?: readonly string[];
}

/**
 * Explicit target runtimes for `unicorn/no-unnecessary-polyfills`.
 *
 * A Browserslist query string, an array of such queries, or a core-js-compat
 * targets object (engine name to a version string or number, plus the special
 * `browsers` / `esmodules` keys). Queries use the native Browserslist resolver
 * with the `production` environment and linted file's directory; target objects
 * enter the native compatibility-target parser. This does not execute target
 * runtimes or certify universal upstream resolver parity.
 *
 * @evidence contracts/common.md#principled-implementation The union preserves Browserslist queries and core-js-compatible target objects as distinct resolver input representations.
 * @evidence contracts/common.md#clear-and-simple-design One value type captures query strings, query lists and target maps without adding resolver machinery.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Targets describe supported runtimes through resolver configuration rather than special-casing consumer polyfill imports.
 * @evidence contracts/common.md#meaningful-documentation The prose identifies queries, engine versions, special keys and production-environment resolution relative to the linted file.
 */
export type TtscLintUnicornNoUnnecessaryPolyfillsTargets =
  | string
  | readonly string[]
  | Readonly<Record<string, string | number | boolean | readonly string[]>>;

/**
 * Options for `unicorn/no-unnecessary-polyfills`.
 *
 * Without this option the rule resolves targets from Browserslist config
 * discovery and, as a last resort, the nearest `package.json` `engines` field.
 * Set `targets` to pin the baseline explicitly. This public options object
 * requires it; the runtime decoder also accepts an empty object and uses normal
 * discovery. Unresolvable targets suppress findings rather than establish
 * runtime support.
 *
 * @reference https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-unnecessary-polyfills.md
 * @evidence contracts/common.md#principled-implementation An explicit options object requires targets while omission of the entire options value leaves discovery to the runtime resolver.
 * @evidence contracts/common.md#clear-and-simple-design The object owns one baseline and delegates accepted representations to the target union.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit targets or normal config discovery establish runtime support without a consumer-specific browser assumption.
 * @evidence contracts/common.md#meaningful-documentation The prose distinguishes missing options from explicit targets and identifies discovery and engines fallback behavior.
 */
export interface ITtscLintUnicornNoUnnecessaryPolyfillsRuleOptions {
  /** Browserslist query, array of queries, or a core-js-compat targets object. */
  targets: TtscLintUnicornNoUnnecessaryPolyfillsTargets;
}

/**
 * Options for `unicorn/no-typeof-undefined`.
 *
 * @evidence contracts/common.md#principled-implementation The boolean determines whether unresolved identifiers and bindings declared outside the linted file join the typeof-undefined comparison check.
 * @evidence contracts/common.md#clear-and-simple-design One optional flag exposes the configurable global-name boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Checker binding ownership defines the boundary rather than a hardcoded list of identifier names.
 * @evidence contracts/common.md#meaningful-documentation The member identifies unresolved and externally declared globals, their suggestion boundary and the disabled default separately.
 */
export interface ITtscLintUnicornNoTypeofUndefinedRuleOptions {
  /**
   * Also report unresolved identifiers and globals declared outside the linted
   * file, including ambient library globals. Eligible edits for these globals
   * are suggestions because accessing an unavailable global can throw.
   *
   * @default false
   */
  checkGlobalVariables?: boolean;
}

/**
 * Options for `unicorn/prefer-number-properties`.
 *
 * @evidence contracts/common.md#principled-implementation Separate booleans extend number-property suggestions to global Infinity and NaN bindings.
 * @evidence contracts/common.md#clear-and-simple-design Each configurable global replacement has its own directly named switch.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Infinity and NaN are language-defined bindings covered by options rather than consumer-specific substitutions.
 * @evidence contracts/common.md#meaningful-documentation Each member identifies its binding and default in a separate documented block.
 */
export interface ITtscLintUnicornPreferNumberPropertiesRuleOptions {
  /**
   * Also replace the global `Infinity` binding.
   *
   * @default false
   */
  checkInfinity?: boolean;

  /**
   * Also replace the global `NaN` binding.
   *
   * @default false
   */
  checkNaN?: boolean;
}

/**
 * Options for `unicorn/text-encoding-identifier-case`.
 *
 * @evidence contracts/common.md#principled-implementation The switch selects the dashed UTF-8 spelling outside the TextDecoder and JSX charset contexts where the rule always selects it.
 * @evidence contracts/common.md#clear-and-simple-design One optional preference represents the configurable encoding-spelling choice.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts TextDecoder and JSX charset syntax establish the rule's canonical-spelling policy rather than particular consumers.
 * @evidence contracts/common.md#meaningful-documentation The member distinguishes the optional UTF-8 preference from the rule's fixed contexts, states the default and limits its effect on other labels.
 */
export interface ITtscLintUnicornTextEncodingIdentifierCaseRuleOptions {
  /**
   * Prefer `utf-8` instead of `utf8` in other positions. The rule always uses
   * `utf-8` for the first TextDecoder argument and JSX meta charset or form
   * accept-charset attributes. This option does not change `ascii` or make
   * unrecognized encoding labels reportable.
   *
   * @default false
   */
  withDash?: boolean;
}
