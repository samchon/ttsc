import type { TtscLintRuleOptionsSetting } from "../TtscLintRuleSetting";
import type { ITtscLintReactPerfRuleOptions } from "./ITtscLintReactPerfRuleOptions";

/**
 * React JSX performance rules from `eslint-plugin-react-perf`.
 *
 * Detects supported allocation-expression forms (arrays, objects, functions,
 * JSX elements) passed as JSX props. The checks inspect syntax, including
 * selected conditional and logical branches; they do not measure renders, prove
 * an identifier resolves to a built-in constructor, or inspect consumers'
 * memoization behavior.
 *
 * Diagnostics only fire on `.tsx` source files — JSX heuristics rely on the
 * file extension, so `.ts` files are skipped even when they contain JSX-like
 * syntax.
 *
 * @reference https://github.com/cvazac/eslint-plugin-react-perf
 *
 * @evidence contracts/common.md#principled-implementation Four optional react-perf identifiers share the same typed intrinsic-prop allowance because they differ in the freshly allocated value they diagnose, not in configuration shape.
 * @evidence contracts/common.md#clear-and-simple-design A dedicated family separates opt-in allocation policies from React correctness rules and reuses one options schema and severity tuple alias.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Allocation-category keys are supported rule identities; the type does not fabricate benchmark results or add fixture-specific options.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains reference identity and the TSX boundary; member comments distinguish arrays, functions, objects and JSX with documentation-guided paragraph and tag separation.
 */
export interface ITtscLintReactPerfRules {
  /**
   * Reject array literals and directly named `Array(...)` / `new Array(...)`
   * expressions in a JSX prop, including supported branches and wrappers.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-array-as-prop.md
   */
  "react-perf/jsx-no-new-array-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject function expressions, arrows, and directly named `Function(...)` /
   * `new Function(...)` expressions in a JSX prop.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-function-as-prop.md
   */
  "react-perf/jsx-no-new-function-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject object literals and directly named `Object(...)` / `new Object(...)`
   * expressions in a JSX prop. Supported wrappers and branches are inspected;
   * downstream memoization is not observed.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-object-as-prop.md
   */
  "react-perf/jsx-no-new-object-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject JSX elements, self-closing elements, and fragments in a JSX prop.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-jsx-as-prop.md
   */
  "react-perf/jsx-no-jsx-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;
}
