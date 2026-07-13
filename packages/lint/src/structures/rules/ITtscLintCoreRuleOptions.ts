/**
 * Options shapes for rules in {@link ITtscLintCoreRules} that accept
 * configuration. Only `no-unused-expressions` is configurable in the current
 * native subset.
 *
 * @reference https://eslint.org/docs/latest/rules/
 */

/**
 * `no-unused-expressions` rule options.
 *
 * Mirrors the upstream ESLint option object; every flag defaults to `false`.
 *
 * @reference https://eslint.org/docs/latest/rules/no-unused-expressions
 */
export interface ITtscLintNoUnusedExpressionsRuleOptions {
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
   * Allow tagged template literal statements — the tag function call may have
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
