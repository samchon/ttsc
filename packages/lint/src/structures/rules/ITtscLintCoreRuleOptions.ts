/**
 * Options shapes for the configurable rules in {@link ITtscLintCoreRules}.
 *
 * @reference https://eslint.org/docs/latest/rules/
 */

/** `no-duplicate-imports` rule options. */
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

/** `no-empty` rule options. */
export interface ITtscLintCoreNoEmptyRuleOptions {
  /**
   * Allow a catch clause with no statements or interior comment. Other empty
   * blocks remain reportable.
   *
   * @default false
   */
  allowEmptyCatch?: boolean;
}

/** Function categories accepted by `no-empty-function`. */
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

/** `no-empty-function` rule options. */
export interface ITtscLintCoreNoEmptyFunctionRuleOptions {
  /**
   * Function categories that may have an empty, uncommented block body.
   * TypeScript parameter-property constructors are always accepted because
   * their parameters initialize fields even when the block has no statements.
   *
   * @default []
   */
  allow?: TtscLintCoreNoEmptyFunctionAllow[];
}

/**
 * `no-unused-expressions` rule options.
 *
 * Mirrors the upstream ESLint option object; every flag defaults to `false`.
 *
 * @reference https://eslint.org/docs/latest/rules/no-unused-expressions
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
 * `no-fallthrough` rule options.
 *
 * Mirrors the ESLint core rule's options schema.
 *
 * @reference https://eslint.org/docs/latest/rules/no-fallthrough
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

/** `no-promise-executor-return` rule options. */
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

/** `prefer-const` rule options. */
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
