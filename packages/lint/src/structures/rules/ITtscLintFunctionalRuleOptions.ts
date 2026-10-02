/**
 * Options shapes for every configurable rule in
 * {@link ITtscLintFunctionalRules}.
 *
 * Most `functional/*` rules share an ignore-pattern block — exposed below as
 * {@link ITtscLintFunctionalPatternOptions} — and then extend it with
 * rule-specific knobs.
 *
 * @reference https://github.com/eslint-functional/eslint-plugin-functional
 */

/**
 * Shared pattern option accepted by several `functional/*` rules.
 *
 * @evidence contracts/common.md#principled-implementation Separate regex inputs select identifier spelling and source text, preserving the native ignore helper's distinction between names and code.
 * @evidence contracts/common.md#clear-and-simple-design A shared base keeps identical ignore policy fields in one place while individual rules own their additional switches.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exemptions are caller-supplied patterns rather than fixture names or mutations of the AST walker.
 * @evidence contracts/common.md#meaningful-documentation Each member identifies what its regex matches; comments and properties are separated, and the owning prose names the shared role.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalPatternOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalPatternOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalPatternOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalPatternOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalPatternOptions {
  /** Identifier regex string(s) the rule should skip. */
  ignoreIdentifierPattern?: string | readonly string[];

  /** Source-code regex string(s) the rule should skip. */
  ignoreCodePattern?: string | readonly string[];
}

/**
 * `functional/functional-parameters` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Rest and arguments allowances are independent booleans; count modes distinguish disabled enforcement, at least one declared parameter and exactly one declared parameter.
 * @evidence contracts/common.md#clear-and-simple-design Parameter-form switches extend the shared ignore base without duplicating regex selection fields.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Parameter exceptions are explicit option values; count enforcement follows the selected mode rather than exempting particular function names.
 * @evidence contracts/common.md#meaningful-documentation Members explain rest parameters, arguments and the native count behavior; paragraph and tag spacing follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalParametersRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalParametersRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalParametersRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalParametersRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalParametersRuleOptions extends ITtscLintFunctionalPatternOptions {
  /** Allow rest parameters such as `(...args: readonly string[])`. */
  allowRestParameter?: boolean;

  /** Allow the legacy `arguments` object. */
  allowArgumentsKeyword?: boolean;

  /**
   * Require at least one declared parameter with `true` or `"atLeastOne"`,
   * exactly one with `"exactlyOne"`, or disable count enforcement with `false`.
   * Omission also disables count enforcement. A rest parameter counts as one
   * declaration; `allowRestParameter` independently controls its
   * permissibility.
   */
  enforceParameterCount?: boolean | "atLeastOne" | "exactlyOne";
}

/**
 * `functional/immutable-data` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The collection exemption distinguishes Map/Set mutation methods from array and property mutations under the native mutation analysis.
 * @evidence contracts/common.md#clear-and-simple-design One collection switch extends the existing pattern base because all remaining mutation selection is shared.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Collection allowance is documented configuration, not mutation of Map or Set methods to conceal writes.
 * @evidence contracts/common.md#meaningful-documentation The member states both the exempt collections and mutations still checked, so its scope is visible without reading the decoder.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalImmutableDataRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalImmutableDataRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalImmutableDataRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalImmutableDataRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalImmutableDataRuleOptions extends ITtscLintFunctionalPatternOptions {
  /**
   * Skip mutating `Map` and `Set` methods while still checking arrays and
   * property assignment.
   */
  ignoreMapsAndSets?: boolean;
}

/**
 * `functional/no-let` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Separate flags represent for-initializer and function-scope allowances, the two AST contexts the native let rule distinguishes.
 * @evidence contracts/common.md#clear-and-simple-design Context switches extend shared ignore patterns rather than creating another declaration classifier in configuration.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Let allowances name actual syntax contexts rather than project-specific variable names or test-only branches.
 * @evidence contracts/common.md#meaningful-documentation Members explain the loop initializer and local-versus-module distinction with separate comments and source spacing.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalNoLetRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalNoLetRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalNoLetRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalNoLetRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalNoLetRuleOptions extends ITtscLintFunctionalPatternOptions {
  /** Permit `let` in a `for` statement initializer. */
  allowInForLoopInit?: boolean;

  /** Permit `let` inside functions while still rejecting module-level `let`. */
  allowInFunctions?: boolean;
}

/**
 * `functional/no-conditional-statements` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The boolean-or-ifExhaustive field represents upstream configuration vocabulary; native rejection remains unconditional and that unsupported distinction is stated explicitly.
 * @evidence contracts/common.md#clear-and-simple-design The sole compatibility field stays attached to its rule rather than introducing a general branch-policy layer.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The comment discloses that this field cannot enable native exceptions; it does not present ignored configuration as implemented policy.
 * @evidence contracts/common.md#meaningful-documentation The member explains the reserved field and actual if/switch rejection, avoiding a promise of unsupported returning-branch analysis.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalNoConditionalStatementsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalNoConditionalStatementsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalNoConditionalStatementsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalNoConditionalStatementsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalNoConditionalStatementsRuleOptions {
  /**
   * Reserved for upstream-compatible configs; the current native rule rejects
   * all `if` / `switch` statements regardless of value.
   */
  allowReturningBranches?: boolean | "ifExhaustive";
}

/**
 * `functional/no-try-statements` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Catch and finally allowances are independent because a single try statement may contain either or both clauses and each remains separately governed.
 * @evidence contracts/common.md#clear-and-simple-design Two direct clause switches express the rule's whole configurable decision without an exception-handling abstraction.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Clause allowances are supported syntax policies rather than wrappers that swallow failures to pass lint.
 * @evidence contracts/common.md#meaningful-documentation Both members identify the permitted clause and the other clause still checked, with separate property comments.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalNoTryStatementsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalNoTryStatementsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalNoTryStatementsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalNoTryStatementsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalNoTryStatementsRuleOptions {
  /** Allow `try/catch` while still checking `finally` when present. */
  allowCatch?: boolean;

  /** Allow `try/finally` while still checking `catch` when present. */
  allowFinally?: boolean;
}

/**
 * `functional/no-throw-statements` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The rejection allowance preserves an upstream boolean input while documenting that the native throw rule does not implement that contextual exemption.
 * @evidence contracts/common.md#clear-and-simple-design One compatibility field belongs to this rule's option object instead of leaking promise policy into unrelated rules.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported promise exceptions are disclosed; no special throw path is invented to pretend the flag has effect.
 * @evidence contracts/common.md#meaningful-documentation The member explicitly states unconditional native rejection, so copying an upstream config does not imply an implemented exception.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalNoThrowStatementsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalNoThrowStatementsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalNoThrowStatementsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalNoThrowStatementsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalNoThrowStatementsRuleOptions {
  /**
   * Reserved for upstream-compatible configs; the current native rule rejects
   * every `throw` statement regardless of value.
   */
  allowToRejectPromises?: boolean;
}

/**
 * `functional/no-mixed-types` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Independent optional booleans select interfaces and type literals, matching the native container-kind gates and their enabled-by-default interpretation.
 * @evidence contracts/common.md#clear-and-simple-design Both supported container gates live in one flat object because the member-kind comparison is the same operation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Exemptions use actual TypeScript container kinds, not filename or expected-diagnostic exceptions.
 * @evidence contracts/common.md#meaningful-documentation Separate member comments identify each container kind and its true default; descriptive prose is separated from acknowledgment tags.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalNoMixedTypesRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalNoMixedTypesRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalNoMixedTypesRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalNoMixedTypesRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalNoMixedTypesRuleOptions {
  /**
   * Check interface member kinds.
   *
   * @default true
   */
  checkInterfaces?: boolean;

  /**
   * Check type-literal member kinds.
   *
   * @default true
   */
  checkTypeLiterals?: boolean;
}

/**
 * `functional/no-return-void` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Null and undefined allowances govern explicit return annotations independently; inferred bare returns have their own gate because they arise from a different source of evidence.
 * @evidence contracts/common.md#clear-and-simple-design One flat object separates declared return categories from the only inferred-return case without conflating their defaults.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Options describe supported annotation and return-statement policies instead of fabricated type-checker knowledge.
 * @evidence contracts/common.md#meaningful-documentation Members state null/undefined defaults and exactly which unannotated bare return ignoreInferredTypes spares, with paragraph separation.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalNoReturnVoidRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalNoReturnVoidRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalNoReturnVoidRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalNoReturnVoidRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalNoReturnVoidRuleOptions {
  /**
   * Permit a function whose declared return type is `null`. Set `false` to
   * reject it the way a declared `void` is rejected.
   *
   * @default true
   */
  allowNull?: boolean;

  /**
   * Permit a function whose declared return type is `undefined`. Set `false` to
   * reject it the way a declared `void` is rejected.
   *
   * @default true
   */
  allowUndefined?: boolean;

  /**
   * Skip a bare `return;` inside a function that declares no return type. That
   * statement is the one place the rule rejects a void-ness it inferred rather
   * than read from an annotation.
   *
   * @default false
   */
  ignoreInferredTypes?: boolean;
}

/**
 * `functional/prefer-immutable-types` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The enforcement union preserves upstream level names and disabling values, while documentation records that native analysis currently computes only readonly-required syntax.
 * @evidence contracts/common.md#clear-and-simple-design Enforcement vocabulary extends the common pattern base; the type does not invent a native immutability lattice.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The unsupported level distinction is stated honestly rather than claiming precise analysis from a coarse syntactic check.
 * @evidence contracts/common.md#meaningful-documentation The member explains the reserved level field and native limitation instead of repeating the union literals as if all were implemented.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalPreferImmutableTypesRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalPreferImmutableTypesRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalPreferImmutableTypesRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalPreferImmutableTypesRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalPreferImmutableTypesRuleOptions extends ITtscLintFunctionalPatternOptions {
  /**
   * Minimum accepted immutability. Reserved for upstream-compatible configs;
   * the native subset computes no immutability level and treats any configured
   * value as readonly-required.
   */
  enforcement?:
    | "ReadonlyShallow"
    | "ReadonlyDeep"
    | "Immutable"
    | "None"
    | false;
}

/**
 * `functional/prefer-readonly-type` rule options.
 *
 * @evidence contracts/common.md#principled-implementation Effective return-position, collection, class and interface gates represent the native syntax boundaries; local-mutation and implicit-position controls explicitly remain unsupported.
 * @evidence contracts/common.md#clear-and-simple-design Shared pattern selection is inherited once, while fields retain the separate positions callers can exempt from this readonly check.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unsupported inferred-type and export-scope decisions are disclosed instead of compensated by guessed type information.
 * @evidence contracts/common.md#meaningful-documentation Comments distinguish effective switches from compatibility fields, explain fieldsOnly and return-signature coverage, and separate defaults from prose.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalPreferReadonlyTypeRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalPreferReadonlyTypeRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalPreferReadonlyTypeRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalPreferReadonlyTypeRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalPreferReadonlyTypeRuleOptions extends ITtscLintFunctionalPatternOptions {
  /**
   * Permit mutation of locals while still policing exported types. Reserved for
   * upstream-compatible configs; the native subset reads type annotations and
   * models no local-versus-exported distinction.
   */
  allowLocalMutation?: boolean;

  /**
   * Permit a mutable return type even when parameters must be readonly. Covers
   * every signature that can declare one, including call and construct
   * signatures, constructor types, and a get accessor.
   *
   * @default false
   */
  allowMutableReturnType?: boolean;

  /**
   * Also check property positions that have no explicit type annotation.
   * Reserved for upstream-compatible configs; judging an unannotated position
   * needs the type checker, which this rule does not use.
   */
  checkImplicit?: boolean;

  /**
   * Skip array / tuple / `Map` / `Set` types.
   *
   * @default false
   */
  ignoreCollections?: boolean;

  /**
   * Skip class members. `true` skips anything under a class, its heritage
   * clause and type parameters included; `"fieldsOnly"` narrows that to field
   * declarations and keeps methods, accessors, and constructor parameters
   * checked.
   *
   * @default false
   */
  ignoreClass?: boolean | "fieldsOnly";

  /**
   * Skip interface members entirely.
   *
   * @default false
   */
  ignoreInterface?: boolean;
}

/**
 * `functional/prefer-tacit` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The optional boolean selects member-expression callees independently of bare identifiers, matching the native forwarding-arrow analysis.
 * @evidence contracts/common.md#clear-and-simple-design A single field exposes the one choice instead of adding separate wrappers for each callee form.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The allowance is a syntax-kind policy, without accepted callback names hardcoded for consumers.
 * @evidence contracts/common.md#meaningful-documentation The member supplies a service.map forwarding example, the false behavior and true default in separated native prose.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalPreferTacitRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalPreferTacitRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalPreferTacitRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalPreferTacitRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalPreferTacitRuleOptions {
  /**
   * Check member expressions such as `x => service.map(x)`. Set `false` to keep
   * the rule on bare-identifier callees only.
   *
   * @default true
   */
  checkMemberExpressions?: boolean;
}

/**
 * `functional/readonly-type` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The keyword/generic literal union represents the two readonly spellings the rule can prefer, excluding unrelated strings at compile time.
 * @evidence contracts/common.md#clear-and-simple-design One preference field expresses a spelling choice without a second immutability-policy mechanism.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The literals name supported syntax modes rather than consumer-specific type aliases.
 * @evidence contracts/common.md#meaningful-documentation The member identifies a readonly spelling preference and its keyword default, with the default tag separated from prose.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalReadonlyTypeRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalReadonlyTypeRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalReadonlyTypeRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalReadonlyTypeRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalReadonlyTypeRuleOptions {
  /**
   * Preferred readonly spelling.
   *
   * @default "keyword"
   */
  prefer?: "keyword" | "generic";
}

/**
 * `functional/type-declaration-immutability` declaration policy.
 *
 * @evidence contracts/common.md#principled-implementation Required identifier selection determines policy membership; level and comparator unions preserve upstream inputs while disclosing that native analysis performs no level comparison.
 * @evidence contracts/common.md#clear-and-simple-design A named per-declaration policy separates selector entries from the containing rule's list and interface gate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The type documents unsupported comparison semantics instead of presenting arbitrary numeric comparator values as implemented mathematics.
 * @evidence contracts/common.md#meaningful-documentation Members explain name/regex matching, readonly-required behavior and absent comparison capability; independent topics retain separate comments.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalTypeDeclarationImmutabilityRule is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalTypeDeclarationImmutabilityRule is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalTypeDeclarationImmutabilityRule is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalTypeDeclarationImmutabilityRule is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalTypeDeclarationImmutabilityRule {
  /** Type / interface name or regex string(s) this policy applies to. */
  identifiers: string | readonly string[];

  /**
   * Reserved for upstream-compatible configs; the current native subset treats
   * every value as readonly-required.
   */
  immutability?: "ReadonlyShallow" | "ReadonlyDeep" | "Immutable" | "Mutable";

  /**
   * Comparator applied to the immutability level above. Reserved for
   * upstream-compatible configs alongside `immutability`: the native subset
   * computes no immutability level, so there is nothing to compare.
   */
  comparator?:
    | "Less"
    | "AtMost"
    | "Exactly"
    | "AtLeast"
    | "More"
    | -2
    | -1
    | 0
    | 1
    | 2;
}

/**
 * `functional/type-declaration-immutability` rule options.
 *
 * @evidence contracts/common.md#principled-implementation A readonly policy list selects declaration names, while ignoreInterfaces narrows the supported declaration-kind population without changing each policy's representation.
 * @evidence contracts/common.md#clear-and-simple-design Shared ignore patterns, named policy entries and the interface gate each own one decision and compose in one option object.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Declaration selection uses configured policies and syntax kinds rather than test-specific declaration names.
 * @evidence contracts/common.md#meaningful-documentation Members state that an empty rules list selects all declarations and that ignoreInterfaces leaves type aliases checked.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions extends ITtscLintFunctionalPatternOptions {
  /** Declaration-name policies. Empty means all type declarations. */
  rules?: readonly ITtscLintFunctionalTypeDeclarationImmutabilityRule[];

  /** Skip interface declarations and only check type aliases. */
  ignoreInterfaces?: boolean;
}

/**
 * Empty object options accepted by simple `functional/*` policy rules.
 *
 * Present as a named type so plugin authors can write `extends
 * ITtscLintFunctionalEmptyRuleOptions` when composing a named options contract.
 * It declares no configurable behavior for the current policy rules.
 *
 * @evidence contracts/common.md#principled-implementation The interface contributes no option members to simple functional policy rules; it represents the named option slot without claiming rule-specific controls.
 * @evidence contracts/common.md#clear-and-simple-design One shared empty interface prevents separate identical empty declarations for each unconditional functional policy.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No hidden flag or synthetic exception is introduced for rules whose native checks are unconditional.
 * @evidence contracts/common.md#meaningful-documentation Owning prose states the current absence of configurable behavior and the named composition role, without promising a future feature.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintFunctionalEmptyRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintFunctionalEmptyRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintFunctionalEmptyRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintFunctionalEmptyRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintFunctionalEmptyRuleOptions {}
