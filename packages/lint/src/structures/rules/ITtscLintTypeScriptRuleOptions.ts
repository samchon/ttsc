/**
 * Options shapes for the configurable rules in {@link ITtscLintTypeScriptRules}.
 *
 * @reference https://typescript-eslint.io/rules/
 */

/**
 * Identifies a type or value declared in a project file.
 *
 * @evidence contracts/common.md#principled-implementation The file discriminant, declared names and optional path distinguish a project-file declaration from library and package declarations in safe-Promise matching.
 * @evidence contracts/common.md#clear-and-simple-design Source-specific path selection stays in the file variant instead of making every origin carry irrelevant fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Declaration matching uses configured names and source identity, without hardcoded safe-call lists for consumers.
 * @evidence contracts/common.md#meaningful-documentation Members explain origin, name-list matching and project-relative file restriction, with blank lines between documented properties.
 */
export interface ITtscLintFileTypeOrValueSpecifier {
  /** Select project-file declarations. */
  from: "file";

  /** Match one or more declared names. */
  name: string | readonly string[];

   /**
    * Restrict the declaration file by path. Relative paths are resolved from
    * the rule's current directory; absolute paths are also accepted. Omission
    * selects non-library declarations within that directory when it is known.
    */
  path?: string;
}

/**
 * Identifies a type or value declared by TypeScript's default libraries.
 *
 * @evidence contracts/common.md#principled-implementation The lib discriminant and name selection identify default-library declarations without requiring a consumer-specific installation path.
 * @evidence contracts/common.md#clear-and-simple-design The library variant has only origin and names because file and package selectors belong to other variants.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Library identity follows the checker declaration source rather than a fixed node_modules directory.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies default-library ownership and members explain the discriminant and one-or-many names separately.
 */
export interface ITtscLintLibTypeOrValueSpecifier {
  /** Select TypeScript default-library declarations. */
  from: "lib";

  /** Match one or more declared names. */
  name: string | readonly string[];
}

/**
 * Identifies a type or value by package source-path or ambient-module ownership.
 *
 * @evidence contracts/common.md#principled-implementation A required package name joins declaration-name selection under the package discriminant, distinguishing same-named declarations with different owners.
 * @evidence contracts/common.md#clear-and-simple-design Package ownership lives only in its source variant rather than an ambiguous generic path/name object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Safe declarations are explicitly selected by package identity, not inferred from fixture imports or patched checker internals.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish package origin, declared names and package-or-ambient-module ownership, with separate property comments.
 */
export interface ITtscLintPackageTypeOrValueSpecifier {
  /** Select package declarations. */
  from: "package";

  /** Match one or more declared names. */
  name: string | readonly string[];

  /** Require declarations from this package or ambient module. */
  package: string;
}

/**
 * Identifies a type or value by name and, preferably, declaration source.
 *
 * @evidence contracts/common.md#principled-implementation The union preserves name-only shorthand and three discriminated source variants, matching the native declaration-origin selector alternatives.
 * @evidence contracts/common.md#clear-and-simple-design Named source variants keep each origin's required data visible and share one reusable safe-call/safe-Promise selector.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Source-aware matching is supported configuration rather than a custom bypass for particular call sites.
 * @evidence contracts/common.md#meaningful-documentation The owning sentence distinguishes name-only from source-qualified matching; each named variant documents its own source requirements.
 */
export type TtscLintTypeOrValueSpecifier =
  | string
  | ITtscLintFileTypeOrValueSpecifier
  | ITtscLintLibTypeOrValueSpecifier
  | ITtscLintPackageTypeOrValueSpecifier;

/**
 * One structured replacement policy in `typescript/no-restricted-types`.
 *
 * @evidence contracts/common.md#principled-implementation Required diagnostic text and optional automatic/opt-in replacements distinguish reporting, direct fixes and editor suggestions as separate effects.
 * @evidence contracts/common.md#clear-and-simple-design One per-type policy groups its message with two replacement channels consumed by the same restriction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Replacement text is explicit caller policy rather than an implementation rewrite chosen only to satisfy a lint result.
 * @evidence contracts/common.md#meaningful-documentation Members explain appended message, ttsc fix replacement and opt-in suggestions, preserving independent comments and spacing.
 */
export interface ITtscLintTypeScriptNoRestrictedTypesTypeConfig {
  /** Custom text appended to the standard diagnostic. */
  message: string;

  /** Replacement applied automatically by `ttsc fix`. */
  fixWith?: string;

  /** Replacement choices exposed as opt-in editor suggestions. */
  suggest?: readonly string[];
}

/**
 * Policy value for one normalized type spelling.
 *
 * @evidence contracts/common.md#principled-implementation Boolean, message-string, structured replacement and null variants represent the native restriction decoder's enabled, customized and disabled policy forms.
 * @evidence contracts/common.md#clear-and-simple-design One policy-value alias centralizes alternatives for every entry of the normalized-spelling map.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Alternative forms preserve supported configuration syntax instead of adding a second consumer-specific restriction channel.
 * @evidence contracts/common.md#meaningful-documentation Owning prose locates the value in a normalized-type policy, and the containing map documents false/null disabling while the structured variant documents replacements.
 */
export type TtscLintTypeScriptNoRestrictedTypesTypeValue =
  | boolean
  | string
  | ITtscLintTypeScriptNoRestrictedTypesTypeConfig
  | null;

/**
 * Options for `typescript/no-restricted-types`.
 *
 * @evidence contracts/common.md#principled-implementation A readonly spelling-to-policy map expresses independently configured type restrictions; documented whitespace normalization matches the native key comparison.
 * @evidence contracts/common.md#clear-and-simple-design The sole map field reuses a named value union instead of duplicating each policy form in the rule object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Restricted types come from explicit policy entries rather than a hardcoded repository-specific ban list.
 * @evidence contracts/common.md#meaningful-documentation The member states spelling normalization and false/null disabling, providing usage facts beyond the map's TypeScript shape.
 */
export interface ITtscLintTypeScriptNoRestrictedTypesRuleOptions {
  /**
   * Type spellings to reject. Whitespace is ignored in both keys and source
   * spellings; `false` and `null` entries explicitly disable a key.
   */
  types?: Readonly<
    Record<string, TtscLintTypeScriptNoRestrictedTypesTypeValue>
  >;
}

/**
 * Options for `typescript/no-floating-promises`.
 *
 * @evidence contracts/common.md#principled-implementation Safe-call and safe-Promise selectors use declaration identity; thenable inclusion, IIFE exemption and explicit void discard remain independent analysis gates.
 * @evidence contracts/common.md#clear-and-simple-design One flat option object groups the declaration selectors and syntax gates this Promise-discard rule owns.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Known-safe declarations come from explicit name-only or source-qualified caller selectors rather than a built-in list of trusted consumers or altered Promise methods.
 * @evidence contracts/common.md#meaningful-documentation Members explain structural-thenable opt-in and safe-discard categories, including IIFE/void defaults with separate paragraphs.
 */
export interface ITtscLintTypeScriptNoFloatingPromisesRuleOptions {
  /** Functions whose returned Promises may be discarded safely. */
  allowForKnownSafeCalls?: readonly TtscLintTypeOrValueSpecifier[];

  /** Promise types whose values may be discarded safely. */
  allowForKnownSafePromises?: readonly TtscLintTypeOrValueSpecifier[];

  /**
   * Check all thenables, not just the built-in `Promise` type. Defaults to
   * `false`, matching `@typescript-eslint/no-floating-promises`.
   *
   * The option selects what the rule examines, so turning it on reports more.
   * Left off, a structural thenable is outside the rule entirely: neither a
   * floating one nor a handled chain on one is reported. A configuration
   * carried over from typescript-eslint retains this thenable-selection
   * default.
   */
  checkThenables?: boolean;

  /**
   * Ignore immediately invoked function-expression results. Defaults to
   * `false`.
   */
  ignoreIIFE?: boolean;

  /** Treat `void` as an explicit discard marker. Defaults to `true`. */
  ignoreVoid?: boolean;
}

/**
 * Policy for one `@ts-<directive>` comment kind in `typescript/ban-ts-comment`.
 *
 * - `true` — report every use of the directive.
 * - `false` — allow the directive unconditionally.
 * - `"allow-with-description"` — allow the directive when it is followed by a
 *   description of at least `minimumDescriptionLength` characters.
 * - `{ descriptionFormat }` — a nonempty pattern also requires a minimum-length
 *   description matching Go's RE2 `regexp` syntax, for example
 *   `"^: TS\\d+ because .+$"`. An empty pattern allows the directive; an invalid
 *   nonempty pattern retains the length gate without a regex match gate.
 *
 * @evidence contracts/common.md#principled-implementation Boolean, description-required and regex-object alternatives separate rejection, allowance and text gates; empty and invalid regex policies are documented rather than treated as enforceable patterns.
 * @evidence contracts/common.md#clear-and-simple-design One union carries each directive's policy while the containing options object owns the shared minimum length.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The regex form states Go RE2 semantics explicitly rather than claiming unsupported JavaScript regex behavior.
 * @evidence contracts/common.md#meaningful-documentation The native list explains every alternative and gives an anchored description-format example; the regex member explains raw leading whitespace.
 */
export type TtscLintTypeScriptBanTsCommentDirectiveConfig =
  | boolean
  | "allow-with-description"
  | {
      /**
       * Regular expression the directive description must match. Matched
       * against the raw text following the directive, including its leading
       * whitespace, so anchored patterns usually start with `^: `.
       */
      descriptionFormat: string;
    };

/**
 * `typescript/ban-ts-comment` rule options.
 *
 * Absent directive keys keep the upstream recommended defaults: `@ts-check` is
 * allowed, `@ts-expect-error` is allowed with a description, and `@ts-ignore` /
 * `@ts-nocheck` are reported.
 *
 * @evidence contracts/common.md#principled-implementation Four independently optional directive policies inherit recommended defaults, while a shared grapheme-count threshold governs description-required forms.
 * @evidence contracts/common.md#clear-and-simple-design Directive-specific choices reuse one policy union and share only the length constraint they all consume.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Defaults follow documented directive policy and Unicode grapheme counting rather than fixture-length assumptions.
 * @evidence contracts/common.md#meaningful-documentation Owning prose states omitted-key defaults; members document Unicode counting, directive purposes and defaults with separated comments.
 */
export interface ITtscLintTypeScriptBanTsCommentRuleOptions {
  /**
   * Minimum description length (counted in Unicode 16.0 extended grapheme
   * clusters, so one emoji is one character) for directives configured as
   * `"allow-with-description"` or a nonempty `{ descriptionFormat }` pattern.
   *
   * @default 3
   */
  minimumDescriptionLength?: number;

  /**
   * Policy for `@ts-check` pragma comments.
   *
   * @default false
   */
  "ts-check"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;

  /**
   * Policy for `@ts-expect-error` directive comments.
   *
   * @default "allow-with-description"
   */
  "ts-expect-error"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;

  /**
   * Policy for `@ts-ignore` directive comments.
   *
   * @default true
   */
  "ts-ignore"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;

  /**
   * Policy for `@ts-nocheck` pragma comments.
   *
   * @default true
   */
  "ts-nocheck"?: TtscLintTypeScriptBanTsCommentDirectiveConfig;
}

/**
 * Positions governed by `checksVoidReturn` in `typescript/no-misused-promises`.
 *
 * Omitted keys default to `true`.
 *
 * @evidence contracts/common.md#principled-implementation Independent optional booleans distinguish six contextual void-return positions; omission preserves native enabled-by-default checking for each position.
 * @evidence contracts/common.md#clear-and-simple-design The named position block separates fine-grained void-return gates from the containing rule's conditional and spread gates.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exemptions select supported TypeScript contexts instead of hardcoded callback names or Promise-return wrappers.
 * @evidence contracts/common.md#meaningful-documentation Owning prose states omitted-key behavior, and each member identifies its call, JSX, inheritance, property, factory or variable position.
 */
export interface ITtscLintTypeScriptNoMisusedPromisesChecksVoidReturnOptions {
  /** Check Promise-returning callbacks passed as call/construct arguments. */
  arguments?: boolean;

  /** Check Promise-returning JSX attribute expressions. */
  attributes?: boolean;

  /** Check Promise-returning methods against extended/implemented types. */
  inheritedMethods?: boolean;

  /** Check Promise-returning functions in contextually typed properties. */
  properties?: boolean;

  /** Check Promise-returning functions returned from void-function factories. */
  returns?: boolean;

  /** Check Promise-returning functions assigned to variables. */
  variables?: boolean;
}

/**
 * `typescript/no-misused-promises` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Conditional/spread gates and a boolean-or-position-object void-return gate represent the native checker's three distinct Promise misuse contexts.
 * @evidence contracts/common.md#clear-and-simple-design A reusable position block is introduced only for the gate that supports fine-grained selection; simple gates remain direct booleans.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Options select actual type-checker contexts rather than promising safety from syntax-only Promise guesses.
 * @evidence contracts/common.md#meaningful-documentation Members explain condition, spread and expected-void behavior and their true defaults, separated from type-level acknowledgment tags.
 */
export interface ITtscLintTypeScriptNoMisusedPromisesRuleOptions {
  /**
   * Check thenables used in boolean condition and predicate positions.
   *
   * @default true
   */
  checksConditionals?: boolean;

  /**
   * Check thenables spread into object literals.
   *
   * @default true
   */
  checksSpreads?: boolean;

  /**
   * Check Promise-returning functions where a void return is expected.
   *
   * @default true
   */
  checksVoidReturn?:
    | boolean
    | ITtscLintTypeScriptNoMisusedPromisesChecksVoidReturnOptions;
}

/**
 * `typescript/switch-exhaustiveness-check` rule options.
 *
 * The defaults require every enumerable union member to have an explicit
 * `case`, allow a redundant `default` on an already exhaustive switch, and do
 * not require a `default` for open types such as `string` or `number`.
 *
 * @reference https://typescript-eslint.io/rules/switch-exhaustiveness-check
 *
 * @evidence contracts/common.md#principled-implementation Separate finite-union coverage, redundant-default and open-type-default gates preserve the distinction between enumerable cases and an unbounded discriminant domain.
 * @evidence contracts/common.md#clear-and-simple-design One object keeps switch coverage policy and its optional trailing-comment marker together without introducing a second exhaustiveness representation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The comment pattern explicitly uses Go RE2 and real default/comment coverage rules rather than hardcoded accepted switch examples.
 * @evidence contracts/common.md#meaningful-documentation Owning prose summarizes defaults; members distinguish real defaults, finite members, open types and the trimmed trailing-comment regex.
 */
export interface ITtscLintTypeScriptSwitchExhaustivenessCheckRuleOptions {
  /**
   * Allow a `default` clause on a switch whose finite members are already
   * covered explicitly.
   *
   * @default true
   */
  allowDefaultCaseForExhaustiveSwitch?: boolean;

  /**
   * Treat a real `default` clause or matching trailing comment as coverage for
   * otherwise missing finite members.
   *
   * @default false
   */
  considerDefaultExhaustiveForUnions?: boolean;

  /**
   * Regular expression matched against the trimmed body of the last comment
   * after the final `case`. The default marker is `/^no default$/iu`.
   *
   * Custom patterns use Go's RE2 `regexp` syntax.
   */
  defaultCaseCommentPattern?: string;

  /**
   * Require a real `default` clause or matching trailing comment when the
   * discriminant contains an open, non-literal type.
   *
   * @default false
   */
  requireDefaultForNonUnion?: boolean;
}
