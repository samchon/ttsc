import type {
  ITtscLintFunctionalEmptyRuleOptions,
  ITtscLintFunctionalImmutableDataRuleOptions,
  ITtscLintFunctionalNoConditionalStatementsRuleOptions,
  ITtscLintFunctionalNoLetRuleOptions,
  ITtscLintFunctionalNoMixedTypesRuleOptions,
  ITtscLintFunctionalNoReturnVoidRuleOptions,
  ITtscLintFunctionalNoThrowStatementsRuleOptions,
  ITtscLintFunctionalNoTryStatementsRuleOptions,
  ITtscLintFunctionalParametersRuleOptions,
  ITtscLintFunctionalPreferImmutableTypesRuleOptions,
  ITtscLintFunctionalPreferReadonlyTypeRuleOptions,
  ITtscLintFunctionalPreferTacitRuleOptions,
  ITtscLintFunctionalReadonlyTypeRuleOptions,
  ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions,
} from "./ITtscLintFunctionalRuleOptions";
import type { TtscLintRuleOptionsSetting } from "../TtscLintRuleSetting";

/**
 * Functional-programming policy rules from `eslint-plugin-functional`.
 * Pushes code toward immutability, side-effect-free expressions, and
 * expression-style control flow.
 *
 * Most rules are useful in pieces — projects rarely enable the whole
 * family at `"error"`. Enabling the whole set together expresses a
 * strict functional-core / imperative-shell discipline.
 *
 * @reference https://github.com/eslint-functional/eslint-plugin-functional
 */
export interface ITtscLintFunctionalRules {
  /**
   * Enforce functional parameter style: reject `arguments`, reject
   * rest parameters, and optionally enforce a per-function
   * parameter-count policy.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/functional-parameters.md
   */
  "functional/functional-parameters"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalParametersRuleOptions>;

  /**
   * Reject property assignment (`obj.x = ...`), element assignment
   * (`arr[0] = ...`), and `Map`/`Set` mutation methods. Configurable
   * to allow mutation inside constructors or initialization
   * expressions.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/immutable-data.md
   */
  "functional/immutable-data"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalImmutableDataRuleOptions>;

  /**
   * Reject `abstract` classes and `extends` clauses on class
   * declarations; prefer composition and structural typing.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-class-inheritance.md
   */
  "functional/no-class-inheritance"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Reject `class` declarations and class expressions altogether.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-classes.md
   */
  "functional/no-classes"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Reject `if` and `switch` *statements*. The conditional-expression
   * forms (ternary, `&&`, `||`) remain allowed.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-conditional-statements.md
   */
  "functional/no-conditional-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoConditionalStatementsRuleOptions>;

  /**
   * Reject expression statements that exist purely for their side
   * effects (`mutate(x);`); pure code is built up from expressions
   * with assigned or returned results.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-expression-statements.md
   */
  "functional/no-expression-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Reject `let` declarations so every binding is `const`. The shared
   * ignore-pattern options can carve out specific identifier shapes
   * (test locals, loop counters) when a full ban is too aggressive.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-let.md
   */
  "functional/no-let"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoLetRuleOptions>;

  /**
   * Reject `for`, `while`, and `do/while` loop statements; use
   * recursive helpers or array methods (`map`, `reduce`) instead.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-loop-statements.md
   */
  "functional/no-loop-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Reject interfaces and type literals that mix property, method,
   * call, and index member kinds; mixed shapes make composition
   * harder.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-mixed-types.md
   */
  "functional/no-mixed-types"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoMixedTypesRuleOptions>;

  /**
   * Reject any call to `Promise.reject(...)`; resolve with an
   * `Option` / `Result` shape so failures stay in the value channel.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-promise-reject.md
   */
  "functional/no-promise-reject"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Reject void returns and functions whose declared return type is
   * `void`; functions should always return a value.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-return-void.md
   */
  "functional/no-return-void"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoReturnVoidRuleOptions>;

  /**
   * Reject any `this` expression. Combined with
   * `functional/no-classes` this leaves no place where `this` is
   * legal; on its own it still forbids `this` in standalone functions,
   * modules, and arrow pipelines.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-this-expressions.md
   */
  "functional/no-this-expressions"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Reject `throw` statements; functional code surfaces failures
   * through return values (`Either`, `Result`) instead.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-throw-statements.md
   */
  "functional/no-throw-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoThrowStatementsRuleOptions>;

  /**
   * Reject `try/catch` and `try/finally` statements as a corollary
   * of `functional/no-throw-statements`.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-try-statements.md
   */
  "functional/no-try-statements"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalNoTryStatementsRuleOptions>;

  /**
   * Require declared variable, parameter, and property types to be
   * `readonly` or otherwise structurally immutable.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/prefer-immutable-types.md
   */
  "functional/prefer-immutable-types"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalPreferImmutableTypesRuleOptions>;

  /**
   * Prefer function-property signatures (`fn: () => T`) over method
   * shorthand (`fn(): T`) in interfaces and type literals.
   *
   * Only the property form accepts `readonly`, so method shorthand
   * silently makes the slot mutable; overloads still need the method
   * form.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/prefer-property-signatures.md
   */
  "functional/prefer-property-signatures"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalEmptyRuleOptions>;

  /**
   * Prefer `readonly` array, tuple, collection, and property types
   * over their mutable counterparts.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/prefer-readonly-type.md
   */
  "functional/prefer-readonly-type"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalPreferReadonlyTypeRuleOptions>;

  /**
   * Reject trivial wrappers such as `x => f(x)` in favor of the tacit
   * form `f`; reduces noise in functional pipelines.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/prefer-tacit.md
   */
  "functional/prefer-tacit"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalPreferTacitRuleOptions>;

  /**
   * Enforce one consistent spelling for readonly types — `readonly
   * T[]` vs `ReadonlyArray<T>` — across the project.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/readonly-type.md
   */
  "functional/readonly-type"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalReadonlyTypeRuleOptions>;

  /**
   * Enforce readonly/immutable type declarations by *declaration
   * name* policy — for projects that want only types matching
   * certain naming conventions to be locked down.
   *
   * @reference https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/type-declaration-immutability.md
   */
  "functional/type-declaration-immutability"?: TtscLintRuleOptionsSetting<ITtscLintFunctionalTypeDeclarationImmutabilityRuleOptions>;
}
