/**
 * Options shapes for every configurable rule in
 * {@link ITtscLintFunctionalRules}.
 *
 * Most `functional/*` rules share an ignore-pattern block — exposed below
 * as {@link ITtscLintFunctionalPatternOptions} — and then extend it with
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
export interface ITtscLintFunctionalParametersRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Allow rest parameters such as `(...args: readonly string[])`. */
  allowRestParameter?: boolean;

  /** Allow the legacy `arguments` object. */
  allowArgumentsKeyword?: boolean;

  /**
   * Require functions to declare parameters. `true` maps to the
   * conservative at-least-one policy.
   */
  enforceParameterCount?: boolean | "atLeastOne" | "exactlyOne";
}

/** `functional/immutable-data` rule options. */
export interface ITtscLintFunctionalImmutableDataRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /**
   * Skip mutating `Map` and `Set` methods while still checking arrays
   * and property assignment.
   */
  ignoreMapsAndSets?: boolean;
}

/** `functional/no-let` rule options. */
export interface ITtscLintFunctionalNoLetRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Permit `let` in a `for` statement initializer. */
  allowInForLoopInit?: boolean;

  /**
   * Permit `let` inside functions while still rejecting module-level
   * `let`.
   */
  allowInFunctions?: boolean;
}

/** `functional/no-conditional-statements` rule options. */
export interface ITtscLintFunctionalNoConditionalStatementsRuleOptions {
  /**
   * Reserved for upstream-compatible configs; the current native rule
   * rejects all `if` / `switch` statements regardless of value.
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
   * Reserved for upstream-compatible configs; the current native rule
   * rejects every `throw` statement regardless of value.
   */
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
  /** Permit a function that returns `null` to satisfy the rule. */
  allowNull?: boolean;

  /** Permit a function that returns `undefined` to satisfy the rule. */
  allowUndefined?: boolean;

  /**
   * Skip functions whose return type is inferred to be `void` rather
   * than declared explicitly.
   */
  ignoreInferredTypes?: boolean;
}

/** `functional/prefer-immutable-types` rule options. */
export interface ITtscLintFunctionalPreferImmutableTypesRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /**
   * Minimum accepted immutability. The native subset treats any
   * configured value as readonly-required.
   */
  enforcement?:
    | "ReadonlyShallow"
    | "ReadonlyDeep"
    | "Immutable"
    | "None"
    | false;
}

/** `functional/prefer-readonly-type` rule options. */
export interface ITtscLintFunctionalPreferReadonlyTypeRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Permit mutation of locals while still policing exported types. */
  allowLocalMutation?: boolean;

  /** Permit a mutable return type even when parameters must be readonly. */
  allowMutableReturnType?: boolean;

  /** Also check property positions that have no explicit type annotation. */
  checkImplicit?: boolean;

  /** Skip array / tuple / `Map` / `Set` types. */
  ignoreCollections?: boolean;

  /**
   * Skip class fields. `"fieldsOnly"` keeps the rule active for
   * non-field class members.
   */
  ignoreClass?: boolean | "fieldsOnly";

  /** Skip interface members entirely. */
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
  /** Type / interface name or regex string(s) this policy applies to. */
  identifiers: string | readonly string[];

  /**
   * Reserved for upstream-compatible configs; the current native subset
   * treats every value as readonly-required.
   */
  immutability?:
    | "ReadonlyShallow"
    | "ReadonlyDeep"
    | "Immutable"
    | "Mutable";

  /** Comparator applied to the immutability level above. */
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
export interface ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions
  extends ITtscLintFunctionalPatternOptions {
  /** Declaration-name policies. Empty means all type declarations. */
  rules?: readonly ITtscLintFunctionalTypeDeclarationImmutabilityRule[];

  /** Skip interface declarations and only check type aliases. */
  ignoreInterfaces?: boolean;
}

/**
 * Empty object options accepted by simple `functional/*` policy rules.
 *
 * Present as a named type so plugin authors can write `extends
 * ITtscLintFunctionalEmptyRuleOptions` while still surviving a future
 * field addition.
 */
export interface ITtscLintFunctionalEmptyRuleOptions {}
