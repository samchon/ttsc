import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";
import type { TtscLintSeverity } from "../TtscLintSeverity";

/**
 * Options shapes for the configurable rules in {@link ITtscLintCoreRules}.
 *
 * @reference https://eslint.org/docs/latest/rules/
 */

/**
 * `no-duplicate-imports` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Separate type-import and re-export flags distinguish whole-clause type identity from additional module references that may be merged.
 * @evidence contracts/common.md#clear-and-simple-design Two independent comparison gates expose the native duplicate rule's choices directly in one object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exceptions are supported import forms rather than fixed module names or mutations of import declarations.
 * @evidence contracts/common.md#meaningful-documentation Members explain clause-level versus inline type imports, mergeable re-exports and false defaults with separated prose.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoDuplicateImportsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoDuplicateImportsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoDuplicateImportsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoDuplicateImportsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoDuplicateImportsRuleOptions {
  /**
   * Keep clause-level `import type` declarations out of the duplicate
   * comparison with value-bearing declarations of the same module, so one
   * runtime import plus one type-only import may coexist. Inline type
   * specifiers such as `import { type Foo }` stay on the value side because the
   * whole import clause is not type-only.
   *
   * @default false
   */
  allowSeparateTypeImports?: boolean;

  /**
   * Also treat `export … from` declarations of an already imported (or
   * re-exported) module as duplicates when the declarations could be merged.
   *
   * @default false
   */
  includeExports?: boolean;
}

/**
 * `no-empty` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The optional catch allowance selects one AST block context while retaining rejection of other uncommented empty blocks.
 * @evidence contracts/common.md#clear-and-simple-design One boolean expresses the sole exception rather than an independent empty-block policy hierarchy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The exception is a documented catch-clause policy instead of a per-file exemption to conceal an empty implementation.
 * @evidence contracts/common.md#meaningful-documentation The member states that statements or interior comments already make a catch nonempty and documents the false default.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoEmptyRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoEmptyRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoEmptyRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoEmptyRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoEmptyRuleOptions {
  /**
   * Allow a catch clause with no statements or interior comment. Other empty
   * blocks remain reportable.
   *
   * @default false
   */
  allowEmptyCatch?: boolean;
}

/**
 * Function categories accepted by `no-empty-function`.
 *
 * @evidence contracts/common.md#principled-implementation Literal categories distinguish callable syntax and TypeScript constructor/decorator/override forms accepted by the native allowance classifier.
 * @evidence contracts/common.md#clear-and-simple-design One category union centralizes the valid allowance vocabulary for the containing rule's list.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The literals name supported declaration categories rather than special function names from tests or consumers.
 * @evidence contracts/common.md#meaningful-documentation Owning prose names the allowance role; literal spellings preserve recognizable syntax categories and the rule options explain their effect.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoEmptyFunctionAllow is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoEmptyFunctionAllow is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoEmptyFunctionAllow is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoEmptyFunctionAllow is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoEmptyFunctionAllow =
  | "functions"
  | "arrowFunctions"
  | "generatorFunctions"
  | "methods"
  | "generatorMethods"
  | "getters"
  | "setters"
  | "constructors"
  | "asyncFunctions"
  | "asyncMethods"
  | "privateConstructors"
  | "protectedConstructors"
  | "decoratedFunctions"
  | "overrideMethods";

/**
 * `no-empty-function` rule options.
 *
 * @evidence contracts/common.md#principled-implementation A typed category list selects permitted empty bodies, while parameter-property constructors retain their actual field-initialization semantics.
 * @evidence contracts/common.md#clear-and-simple-design One allowance list reuses the category union instead of duplicating a boolean for every callable form.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Supported category exemptions do not depend on function names or fixture locations.
 * @evidence contracts/common.md#meaningful-documentation The member explains uncommented empty bodies, automatic parameter-property acceptance and the empty-list default.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoEmptyFunctionRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoEmptyFunctionRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoEmptyFunctionRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoEmptyFunctionRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoEmptyFunctionRuleOptions {
  /**
   * Function categories that may have an empty, uncommented block body.
   * TypeScript parameter-property constructors are always accepted because
   * their parameters initialize fields even when the block has no statements.
   *
   * @default [ ]
   */
  allow?: TtscLintCoreNoEmptyFunctionAllow[];
}

/**
 * `no-unused-expressions` rule options.
 *
 * Mirrors the upstream ESLint option object; every flag defaults to `false`.
 *
 * @reference https://eslint.org/docs/latest/rules/no-unused-expressions
 *
 * @evidence contracts/common.md#principled-implementation Independent expression-form flags preserve the distinction between productive branches, tagged calls, JSX and directive-prologue interpretation.
 * @evidence contracts/common.md#clear-and-simple-design One flat object exposes only the syntax allowances the unused-expression check consumes.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Directive compatibility is tied to documented ESTree versus TypeScript syntax semantics, not arbitrary accepted strings.
 * @evidence contracts/common.md#meaningful-documentation Members provide productive/unproductive branch examples and explain directive defaults, with separate paragraphs and property spacing.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoUnusedExpressionsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoUnusedExpressionsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoUnusedExpressionsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoUnusedExpressionsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoUnusedExpressionsRuleOptions {
  /**
   * Allow short-circuit expression statements such as `a && b()`. Only the
   * right-hand side must be a productive expression; `a && b` stays reported.
   *
   * @default false
   */
  allowShortCircuit?: boolean;

  /**
   * Allow ternary expression statements such as `a ? b() : c()`. Both result
   * branches must be productive expressions; `a ? b() : c` stays reported.
   *
   * @default false
   */
  allowTernary?: boolean;

  /**
   * Allow tagged template literal statements. The tag function call may have
   * side effects. Untagged template literal statements stay reported.
   *
   * @default false
   */
  allowTaggedTemplates?: boolean;

  /**
   * Report JSX elements and fragments standing alone as statements. By default
   * they are accepted because rendering libraries may evaluate them for side
   * effects.
   *
   * @default false
   */
  enforceForJSX?: boolean;

  /**
   * Also exempt statements that positionally look like directive-prologue
   * members under the loose ESTree view upstream ESLint uses, in which
   * parentheses are invisible: a parenthesized string inside the leading string
   * run of a script, module, namespace body, or function body is not reported.
   * Real (unparenthesized) directive prologues are always exempt regardless of
   * this flag.
   *
   * @default false
   */
  ignoreDirectives?: boolean;
}

/**
 * Object option for ESLint's canonical `no-inner-declarations` tuple.
 *
 * @evidence contracts/common.md#principled-implementation The allow/disallow literal union governs strict ES2015 block-scoped functions independently of the tuple's declaration-category mode.
 * @evidence contracts/common.md#clear-and-simple-design A separate object type owns the second option slot rather than mixing positional mode into object fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The option represents supported strict-context semantics rather than suppressing selected declarations by filename.
 * @evidence contracts/common.md#meaningful-documentation The member names strict scripts/functions, modules and class code and states the allow default.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoInnerDeclarationsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoInnerDeclarationsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoInnerDeclarationsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoInnerDeclarationsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoInnerDeclarationsRuleOptions {
  /**
   * Allow ES2015 block-scoped function declarations in strict scripts and
   * function bodies, modules, and class code, or report them as a style
   * policy.
   *
   * @default "allow"
   */
  blockScopedFunctions?: "allow" | "disallow";
}

/**
 * Canonical positional setting for `no-inner-declarations`.
 *
 * The declaration mode is ESLint's first option. The optional object remains
 * the second option, so existing ESLint configurations can be copied without
 * reshaping them into a ttsc-only object.
 *
 * @evidence contracts/common.md#principled-implementation Tuple alternatives preserve severity, declaration mode and optional second object in their canonical positions; a bare setting remains valid.
 * @evidence contracts/common.md#clear-and-simple-design One setting alias reuses severity and object types while keeping each permitted tuple arity explicit.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Positional compatibility follows ESLint's real schema rather than a custom reshaping wrapper for copied configurations.
 * @evidence contracts/common.md#meaningful-documentation Owning prose explains first and second option positions and why the native setting preserves them, separated from tags.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoInnerDeclarationsRuleSetting is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoInnerDeclarationsRuleSetting is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoInnerDeclarationsRuleSetting is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoInnerDeclarationsRuleSetting is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoInnerDeclarationsRuleSetting =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, "functions" | "both"]
  | readonly [
      TtscLintSeverity,
      "functions" | "both",
      ITtscLintCoreNoInnerDeclarationsRuleOptions,
    ];

/**
 * One restriction accepted by ESLint's `no-restricted-syntax` rule.
 *
 * @evidence contracts/common.md#principled-implementation String shorthand and selector/message objects represent the same AST restriction with optional diagnostic customization.
 * @evidence contracts/common.md#clear-and-simple-design One selector union keeps matching semantics independent of whether an entry overrides the diagnostic.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Restrictions use supported AST selector evaluation rather than consumer-specific branches in the native rule.
 * @evidence contracts/common.md#meaningful-documentation Native member comments identify the TypeScript-Go AST selector and canonical-message replacement, with member spacing.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoRestrictedSyntaxSelector is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoRestrictedSyntaxSelector is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoRestrictedSyntaxSelector is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoRestrictedSyntaxSelector is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoRestrictedSyntaxSelector =
  | string
  | {
      /** Esquery selector evaluated against the TypeScript-Go AST. */
      selector: string;

      /** Diagnostic text replacing the canonical default message. */
      message?: string;
    };

/**
 * Canonical variadic setting for `no-restricted-syntax`.
 *
 * Every tuple item after the severity is one independently reported selector. A
 * bare severity or one-element tuple carries no selectors and is silent.
 *
 * @evidence contracts/common.md#principled-implementation A variadic tuple accepts independently evaluated selectors after severity without changing their order or conflating several entries into one object.
 * @evidence contracts/common.md#clear-and-simple-design The setting reuses the common severity form and one selector union instead of introducing a separate selector collection protocol.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The variadic representation preserves supported ESLint input grammar rather than wrapping each restriction in invented configuration.
 * @evidence contracts/common.md#meaningful-documentation Owning prose states per-entry reporting and the silent empty-selector case, making tuple semantics explicit.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoRestrictedSyntaxRuleSetting is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoRestrictedSyntaxRuleSetting is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoRestrictedSyntaxRuleSetting is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoRestrictedSyntaxRuleSetting is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoRestrictedSyntaxRuleSetting =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, ...TtscLintCoreNoRestrictedSyntaxSelector[]];

/**
 * `no-fallthrough` rule options.
 *
 * Mirrors the ESLint core rule's options schema.
 *
 * @reference https://eslint.org/docs/latest/rules/no-fallthrough
 *
 * @evidence contracts/common.md#principled-implementation A marker regex, empty-case allowance and unused-marker check distinguish intentional transitions, adjacent labels and comments contradicted by control flow.
 * @evidence contracts/common.md#clear-and-simple-design Three direct fields expose distinct fallthrough-policy decisions without duplicating the control-flow analysis in configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A custom marker replaces the documented default; acceptance does not depend on fixture labels or particular switch values.
 * @evidence contracts/common.md#meaningful-documentation Members explain marker replacement, blank-line empty cases and stale comments, with defaults separated from prose.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintNoFallthroughRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintNoFallthroughRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintNoFallthroughRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintNoFallthroughRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintNoFallthroughRuleOptions {
  /**
   * Regular expression string that an intentional-fallthrough comment must
   * match. Setting it replaces the default marker pattern
   * (`/falls?\s?through/i`) entirely, so the standard `// falls through`
   * spellings stop being accepted unless the custom pattern matches them.
   *
   * @default "falls?\\s?through" (case-insensitive)
   */
  commentPattern?: string;

  /**
   * Allow a case with no statements to be separated from the next label by
   * blank lines. By default an empty case followed by a blank line is treated
   * as an accidental fallthrough; adjacent labels (`case 0: case 1:`) are
   * always allowed.
   *
   * @default false
   */
  allowEmptyCase?: boolean;

  /**
   * Report fallthrough marker comments on cases that cannot actually fall
   * through (for example a `// falls through` after a `break`), since the
   * comment documents behavior the code no longer has.
   *
   * @default false
   */
  reportUnusedFallthroughComment?: boolean;
}

/**
 * `no-promise-executor-return` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The boolean distinguishes explicit unary void discard from expressions merely typed void, preserving the executor-return rule's syntactic intent.
 * @evidence contracts/common.md#clear-and-simple-design A single gate serves both concise arrows and return-void statements without separate controls for equivalent discard forms.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The allowance is based on the explicit operator rather than guessed Promise behavior or executor-name exceptions.
 * @evidence contracts/common.md#meaningful-documentation The member identifies both supported discard forms and the typed-void case still reported, with a false default.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoPromiseExecutorReturnRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoPromiseExecutorReturnRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoPromiseExecutorReturnRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoPromiseExecutorReturnRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoPromiseExecutorReturnRuleOptions {
  /**
   * Allow an executor to explicitly discard a value with the unary `void`
   * operator, in either a concise arrow body or a `return void expression`
   * statement. Other expressions that happen to have the `void` type remain
   * reportable because their explicit return value is still ignored.
   *
   * @default false
   */
  allowVoid?: boolean;
}

/**
 * `no-param-reassign` rule options.
 *
 * The ignore lists are meaningful only when property writes are enabled. The
 * discriminated union preserves ESLint's schema: an explicit `props: false`
 * object may not carry either ignore list. ESLint also accepts an ignore list
 * with `props` omitted, although it stays inactive until `props` is `true`.
 *
 * @reference https://eslint.org/docs/latest/rules/no-param-reassign
 *
 * @evidence contracts/common.md#principled-implementation The union forbids ignore lists with explicit props:false while permitting their supported omitted-props form, preserving the upstream distinction between accepted input and active policy.
 * @evidence contracts/common.md#clear-and-simple-design Discriminated alternatives keep inactive and property-checking configurations visible without a second options validator type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Named and regex exemptions are explicit property-write policy inputs, not production changes made solely to appease the checker.
 * @evidence contracts/common.md#meaningful-documentation Owning prose explains when ignore lists have effect and why omission differs from explicit false; members document names and Unicode regex matching.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoParamReassignRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoParamReassignRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoParamReassignRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoParamReassignRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type ITtscLintCoreNoParamReassignRuleOptions =
  | {
      /**
       * Report writes to properties reached through a parameter reference.
       *
       * @default false
       */
      props?: false;

      ignorePropertyModificationsFor?: never;

      ignorePropertyModificationsForRegex?: never;
    }
  | {
      /** Report writes to properties reached through a parameter reference. */
      props?: true;

      /** Parameter names whose property writes are accepted. */
      ignorePropertyModificationsFor?: string[];

      /**
       * Unicode regular-expression strings matched against parameter names
       * whose property writes are accepted.
       */
      ignorePropertyModificationsForRegex?: string[];
    };

/** Shared message and type-import switches for one restricted import entry. */
interface ITtscLintCoreNoRestrictedImportsEntryBase {
  /** Text appended to the standard diagnostic. */
  message?: string;

  /** Permit whole type-only declarations and type-only named specifiers. */
  allowTypeImports?: boolean;
}

/** Non-empty string collection required by structured pattern controls. */
type TtscLintCoreNoRestrictedImportsNonEmptyStrings = readonly [
  string,
  ...string[],
];

/** Mutually exclusive imported-name controls accepted for an exact path. */
type TtscLintCoreNoRestrictedImportsPathNames =
  | {
      /** Imported names to reject; aliases are matched by their source name. */
      importNames?: string[];

      allowImportNames?: never;
    }
  | {
      importNames?: never;

      /** Reject every imported name outside this allowlist. */
      allowImportNames: string[];
    };

/**
 * One exact path restriction in `no-restricted-imports`.
 *
 * @evidence contracts/common.md#principled-implementation String shorthand and structured exact-path entries preserve mutually exclusive rejected-name versus allowed-name modes through the shared helper union.
 * @evidence contracts/common.md#clear-and-simple-design Message/type-import fields and name controls are composed once; the exact module name remains owned by this path variant.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exact restrictions are explicit config entries rather than fixed import prohibitions in the host.
 * @evidence contracts/common.md#meaningful-documentation The path member states exact specifier matching; shared native comments explain source-name aliases and type-import allowances.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoRestrictedImportsPath is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoRestrictedImportsPath is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoRestrictedImportsPath is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoRestrictedImportsPath is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoRestrictedImportsPath =
  | string
  | (ITtscLintCoreNoRestrictedImportsEntryBase &
      TtscLintCoreNoRestrictedImportsPathNames & {
        /** Module specifier matched exactly. */
        name: string;
      });

/** Mutually exclusive imported-name controls accepted for a path pattern. */
type TtscLintCoreNoRestrictedImportsPatternNames =
  | {
      /** Imported names rejected by exact match. */
      importNames?: TtscLintCoreNoRestrictedImportsNonEmptyStrings;

      /** Imported names rejected by a regular expression. */
      importNamePattern?: string;

      allowImportNames?: never;

      allowImportNamePattern?: never;
    }
  | {
      importNames?: never;

      importNamePattern?: never;

      /** Reject every imported name outside this allowlist. */
      allowImportNames: TtscLintCoreNoRestrictedImportsNonEmptyStrings;

      allowImportNamePattern?: never;
    }
  | {
      importNames?: never;

      importNamePattern?: never;

      allowImportNames?: never;

      /** Reject every imported name that does not match this expression. */
      allowImportNamePattern: string;
    };

/**
 * One gitignore-style group or regular-expression path restriction.
 *
 * @evidence contracts/common.md#principled-implementation Mutually exclusive group/regex variants and nonempty name controls encode supported pattern restrictions without permitting contradictory selector modes.
 * @evidence contracts/common.md#clear-and-simple-design Shared message and imported-name helper types compose with one path-pattern choice, keeping each responsibility local.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Pattern semantics and explicit case folding follow the rule contract rather than hidden filesystem-dependent exceptions.
 * @evidence contracts/common.md#meaningful-documentation Members explain gitignore order/negation, regex source and case sensitivity; helper comments identify reject and allow controls separately.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoRestrictedImportsPattern is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoRestrictedImportsPattern is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoRestrictedImportsPattern is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoRestrictedImportsPattern is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type ITtscLintCoreNoRestrictedImportsPattern =
  ITtscLintCoreNoRestrictedImportsEntryBase &
    TtscLintCoreNoRestrictedImportsPatternNames & {
      /** Match module specifiers case-sensitively instead of the default fold. */
      caseSensitive?: boolean;
    } & (
      | {
          /** Ordered gitignore-style path patterns, including `!` negation. */
          group: TtscLintCoreNoRestrictedImportsNonEmptyStrings;

          regex?: never;
        }
      | {
          group?: never;

          /** Regular expression tested against the module specifier. */
          regex: string;
        }
    );

/**
 * Object form of the current ESLint `no-restricted-imports` options.
 *
 * @evidence contracts/common.md#principled-implementation Exact-path and pattern arrays select different matching mechanisms while reusing the constrained entry representations that prevent contradictory modes.
 * @evidence contracts/common.md#clear-and-simple-design The object owns only the two collections; individual restriction semantics stay in their named entry types.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Restrictions are caller-configured collections rather than consumer-specific import exceptions hidden in the compiler.
 * @evidence contracts/common.md#meaningful-documentation Members distinguish exact module specifiers from gitignore-style strings and structured pattern entries, with separate comments.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoRestrictedImportsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoRestrictedImportsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoRestrictedImportsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoRestrictedImportsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoRestrictedImportsRuleOptions {
  /** Exact module specifiers to restrict. */
  paths?: TtscLintCoreNoRestrictedImportsPath[];

  /** Gitignore-style strings or structured pattern entries. */
  patterns?: string[] | ITtscLintCoreNoRestrictedImportsPattern[];
}

/**
 * Canonical setting for `no-restricted-imports`.
 *
 * ESLint accepts either positional path entries or one `{ paths, patterns }`
 * object. Both forms remain available so existing configurations need no
 * ttsc-specific reshaping.
 *
 * @evidence contracts/common.md#principled-implementation Tuple alternatives preserve either one structured object or positional path entries after severity, retaining the native decoder's distinct accepted input shapes.
 * @evidence contracts/common.md#clear-and-simple-design One setting alias assembles existing path/object types without introducing a redundant translation format.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Compatibility is for ESLint's documented tuple grammar, not a consumer-specific rewrite of unknown option structures.
 * @evidence contracts/common.md#meaningful-documentation Owning paragraphs explain both canonical forms and the reason copied configurations retain their shape, with blank tag separation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoRestrictedImportsRuleSetting is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoRestrictedImportsRuleSetting is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoRestrictedImportsRuleSetting is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoRestrictedImportsRuleSetting is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoRestrictedImportsRuleSetting =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, ITtscLintCoreNoRestrictedImportsRuleOptions]
  | readonly [
      TtscLintSeverity,
      TtscLintCoreNoRestrictedImportsPath,
      ...TtscLintCoreNoRestrictedImportsPath[],
    ];

/**
 * `prefer-const` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The any/all destructuring mode distinguishes binding-local eligibility from whole-pattern eligibility; read-before-first-write treatment is an independent scope constraint.
 * @evidence contracts/common.md#clear-and-simple-design Two direct options expose the native reassignment analysis's decisions without introducing separate binding-policy objects.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The read-before-write exception addresses a documented no-use-before-define interaction instead of a compensating fixture-specific exemption.
 * @evidence contracts/common.md#meaningful-documentation Members explain each destructuring mode and the declaration-location conflict, with defaults and properties visibly separated.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCorePreferConstRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCorePreferConstRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCorePreferConstRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCorePreferConstRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCorePreferConstRuleOptions {
  /**
   * Report each const-eligible binding in a destructuring pattern (`"any"`), or
   * report the pattern only when every binding is const-eligible (`"all"`).
   *
   * @default "any"
   */
  destructuring?: "any" | "all";

  /**
   * Ignore a declaration-only binding when it is read before its first
   * assignment. This avoids a conflict with `no-use-before-define` policies
   * that require the declaration to stay at its original location.
   *
   * @default false
   */
  ignoreReadBeforeAssign?: boolean;
}

/**
 * `default-case` rule options.
 *
 * @evidence contracts/common.md#principled-implementation An optional regex represents a deliberate omitted-default marker, distinct from actually containing a default clause.
 * @evidence contracts/common.md#clear-and-simple-design One marker field owns the only configurable acceptance decision of the default-case rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The custom pattern explicitly replaces the canonical marker rather than accumulating hidden accepted comment spellings.
 * @evidence contracts/common.md#meaningful-documentation The member states intentional omission and replacement of the default no-default regex, instead of repeating the property name.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreDefaultCaseRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreDefaultCaseRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreDefaultCaseRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreDefaultCaseRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreDefaultCaseRuleOptions {
  /**
   * Regular-expression string that marks an intentionally omitted default
   * clause. It replaces the default `^no default$` pattern.
   */
  commentPattern?: string;
}

/**
 * Relative order accepted by `grouped-accessor-pairs`.
 *
 * @evidence contracts/common.md#principled-implementation Literal any/get-before-set/set-before-get alternatives represent adjacency without order, or one of the two directional orders.
 * @evidence contracts/common.md#clear-and-simple-design One union centralizes ordering vocabulary for the positional rule setting.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The modes describe supported accessor relationships instead of exempting selected property names.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies relative ordering and the literal spellings make each permitted direction recognizable.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreGroupedAccessorPairsOrder is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreGroupedAccessorPairsOrder is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreGroupedAccessorPairsOrder is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreGroupedAccessorPairsOrder is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreGroupedAccessorPairsOrder =
  | "anyOrder"
  | "getBeforeSet"
  | "setBeforeGet";

/**
 * Canonical positional setting for `grouped-accessor-pairs`.
 *
 * @evidence contracts/common.md#principled-implementation The optional two-item tuple places the ordering mode immediately after severity, preserving the native rule's positional input.
 * @evidence contracts/common.md#clear-and-simple-design The setting composes common severity and one named order union without a redundant object wrapper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Positional ordering follows the supported configuration grammar rather than special handling of copied project configs.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies positional use and the named order union documents the supported modes.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreGroupedAccessorPairsRuleSetting is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreGroupedAccessorPairsRuleSetting is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreGroupedAccessorPairsRuleSetting is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreGroupedAccessorPairsRuleSetting is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreGroupedAccessorPairsRuleSetting =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, TtscLintCoreGroupedAccessorPairsOrder];

/**
 * `no-else-return` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The boolean independently permits else-if continuation after a returning branch while retaining rejection of unnecessary plain else blocks.
 * @evidence contracts/common.md#clear-and-simple-design One direct exception field matches the only configurable distinction in the rule.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The exception names a supported branch form rather than consumer-specific control-flow patterns.
 * @evidence contracts/common.md#meaningful-documentation The member states its returning-branch context and true default in separate prose and tag lines.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoElseReturnRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoElseReturnRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoElseReturnRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoElseReturnRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoElseReturnRuleOptions {
  /**
   * Allow an `else if` after a branch that always returns.
   *
   * @default true
   */
  allowElseIf?: boolean;
}

/**
 * `no-extend-native` rule options.
 *
 * @evidence contracts/common.md#principled-implementation A readonly constructor-name list represents the explicit exemptions to the native prototype-extension prohibition.
 * @evidence contracts/common.md#clear-and-simple-design One name list exposes exemptions without a second prototype metadata structure.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type describes a lint allowance; it does not itself replace or patch any foreign prototype method.
 * @evidence contracts/common.md#meaningful-documentation The member identifies native constructor names, prototype-extension scope and the empty default, with a blank prose-to-tag line.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoExtendNativeRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoExtendNativeRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoExtendNativeRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoExtendNativeRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoExtendNativeRuleOptions {
  /**
   * Native constructor names whose prototypes may be extended.
   *
   * @default [ ]
   */
  exceptions?: readonly string[];
}

/**
 * Operator spelling accepted in a `no-mixed-operators` group.
 *
 * @evidence contracts/common.md#principled-implementation The literal union restricts group entries to recognized arithmetic, bitwise, relational, logical and conditional operator spellings.
 * @evidence contracts/common.md#clear-and-simple-design One vocabulary alias serves all operator groups instead of representing each operator as a separate policy object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Literal spellings express the supported language operators, not handpicked expression examples or measured outcomes.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies group membership and the listed spellings retain the exact user-facing selector vocabulary.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoMixedOperatorsOperator is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoMixedOperatorsOperator is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoMixedOperatorsOperator is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoMixedOperatorsOperator is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoMixedOperatorsOperator =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "**"
  | "&"
  | "|"
  | "^"
  | "~"
  | "<<"
  | ">>"
  | ">>>"
  | "=="
  | "!="
  | "==="
  | "!=="
  | ">"
  | ">="
  | "<"
  | "<="
  | "&&"
  | "||"
  | "in"
  | "instanceof"
  | "??"
  | "?:";

/**
 * `no-mixed-operators` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Readonly groups select which operators interact; a separate same-precedence allowance distinguishes grouping policy from the language's precedence relation.
 * @evidence contracts/common.md#clear-and-simple-design One grouped collection and one boolean express the rule's two decisions without duplicating precedence tables in the type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Operator groups are explicit config, while precedence remains owned by the native syntax implementation.
 * @evidence contracts/common.md#meaningful-documentation Members explain unparenthesized mixing, same-precedence allowance and the true default with separate comments.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintCoreNoMixedOperatorsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintCoreNoMixedOperatorsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintCoreNoMixedOperatorsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintCoreNoMixedOperatorsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintCoreNoMixedOperatorsRuleOptions {
  /** Operator groups within which an unparenthesized mix is checked. */
  groups?: readonly (readonly TtscLintCoreNoMixedOperatorsOperator[])[];

  /**
   * Allow different operators with the same precedence.
   *
   * @default true
   */
  allowSamePrecedence?: boolean;
}

/**
 * Canonical positional mode for `no-return-assign`.
 *
 * @evidence contracts/common.md#principled-implementation The except-parens/always union distinguishes parenthesized intent from unconditional rejection of assignment returns.
 * @evidence contracts/common.md#clear-and-simple-design One mode alias owns the whole positional choice without an unused options object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Modes describe syntax policy rather than accepted assignment targets tailored to known callers.
 * @evidence contracts/common.md#meaningful-documentation Owning prose identifies the positional role and both literal names express their different parenthesis treatment.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoReturnAssignMode is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoReturnAssignMode is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoReturnAssignMode is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoReturnAssignMode is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoReturnAssignMode = "except-parens" | "always";

/**
 * Canonical positional setting for `no-return-assign`.
 *
 * @evidence contracts/common.md#principled-implementation The severity-plus-mode tuple preserves the canonical positional rule setting while allowing the shared severity-only forms.
 * @evidence contracts/common.md#clear-and-simple-design Existing severity and mode types compose directly instead of requiring a ttsc-specific wrapper.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The tuple reflects the actual rule grammar rather than a consumer-specific compatibility branch.
 * @evidence contracts/common.md#meaningful-documentation The owning comment names positional use and the referenced mode keeps the allowed assignment-return policies visible.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation TtscLintCoreNoReturnAssignRuleSetting is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms TtscLintCoreNoReturnAssignRuleSetting is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work TtscLintCoreNoReturnAssignRuleSetting is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources TtscLintCoreNoReturnAssignRuleSetting is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export type TtscLintCoreNoReturnAssignRuleSetting =
  | TtscLintRuleSetting
  | readonly [TtscLintSeverity, TtscLintCoreNoReturnAssignMode];
