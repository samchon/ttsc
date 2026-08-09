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

/** Shared pattern option accepted by several `functional/*` rules. */
export interface ITtscLintFunctionalPatternOptions {
  /** Identifier regex string(s) the rule should skip. */
  ignoreIdentifierPattern?: string | readonly string[];

  /** Source-code regex string(s) the rule should skip. */
  ignoreCodePattern?: string | readonly string[];
}

/** `functional/functional-parameters` rule options. */
export interface ITtscLintFunctionalParametersRuleOptions extends ITtscLintFunctionalPatternOptions {
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
export interface ITtscLintFunctionalImmutableDataRuleOptions extends ITtscLintFunctionalPatternOptions {
  /**
   * Skip mutating `Map` and `Set` methods while still checking arrays and
   * property assignment.
   */
  ignoreMapsAndSets?: boolean;
}

/** `functional/no-let` rule options. */
export interface ITtscLintFunctionalNoLetRuleOptions extends ITtscLintFunctionalPatternOptions {
  /** Permit `let` in a `for` statement initializer. */
  allowInForLoopInit?: boolean;

  /** Permit `let` inside functions while still rejecting module-level `let`. */
  allowInFunctions?: boolean;
}

/** `functional/no-conditional-statements` rule options. */
export interface ITtscLintFunctionalNoConditionalStatementsRuleOptions {
  /**
   * Reserved for upstream-compatible configs; the current native rule rejects
   * all `if` / `switch` statements regardless of value.
   */
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
  /**
   * Reserved for upstream-compatible configs; the current native rule rejects
   * every `throw` statement regardless of value.
   */
  allowToRejectPromises?: boolean;
}

/** `functional/no-mixed-types` rule options. */
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

/** `functional/no-return-void` rule options. */
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

/** `functional/prefer-immutable-types` rule options. */
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

/** `functional/prefer-readonly-type` rule options. */
export interface ITtscLintFunctionalPreferReadonlyTypeRuleOptions extends ITtscLintFunctionalPatternOptions {
  /**
   * Permit mutation of locals while still policing exported types. Reserved for
   * upstream-compatible configs; the native subset reads type annotations and
   * models no local-versus-exported distinction.
   */
  allowLocalMutation?: boolean;

  /**
   * Permit a mutable return type even when parameters must be readonly.
   *
   * @default false
   */
  allowMutableReturnType?: boolean;

  /**
   * Also check property positions that have no explicit type annotation.
   * Reserved for upstream-compatible configs; the native subset visits type
   * nodes, and an unannotated position has none.
   */
  checkImplicit?: boolean;

  /**
   * Skip array / tuple / `Map` / `Set` types.
   *
   * @default false
   */
  ignoreCollections?: boolean;

  /**
   * Skip class fields. Reserved for upstream-compatible configs; the native
   * subset visits no class-member position, so class fields are already never
   * reported.
   */
  ignoreClass?: boolean | "fieldsOnly";

  /**
   * Skip interface members entirely.
   *
   * @default false
   */
  ignoreInterface?: boolean;
}

/** `functional/prefer-tacit` rule options. */
export interface ITtscLintFunctionalPreferTacitRuleOptions {
  /**
   * Check member expressions such as `x => service.map(x)`. Set `false` to keep
   * the rule on bare-identifier callees only.
   *
   * @default true
   */
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

/** `functional/type-declaration-immutability` rule options. */
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
 * ITtscLintFunctionalEmptyRuleOptions` while still surviving a future field
 * addition.
 */
export interface ITtscLintFunctionalEmptyRuleOptions {}
