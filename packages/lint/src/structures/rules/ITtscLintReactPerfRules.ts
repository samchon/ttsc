import type { TtscLintRuleOptionsSetting } from "../TtscLintRuleSetting";
import type { ITtscLintReactPerfRuleOptions } from "./ITtscLintReactPerfRuleOptions";

/**
 * React JSX performance rules from `eslint-plugin-react-perf`.
 *
 * Detects freshly-allocated reference values (arrays, objects, functions, JSX
 * elements) passed as JSX props. A new reference invalidates `React.memo` /
 * `useMemo` shallow checks on every render. Useful for performance-critical
 * render paths; usually unnecessary for top-level pages.
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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintReactPerfRules is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintReactPerfRules is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintReactPerfRules is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintReactPerfRules is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintReactPerfRules {
  /**
   * Reject array literals (`[...]`) passed inline as a JSX prop. Hoist the
   * array outside the render or stabilize it with `useMemo`.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-array-as-prop.md
   */
  "react-perf/jsx-no-new-array-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject inline `function` expressions / arrow functions passed as a JSX
   * prop. Stabilize with `useCallback`.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-function-as-prop.md
   */
  "react-perf/jsx-no-new-function-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject inline object literals (`{...}`) passed as a JSX prop.
   *
   * A fresh object on every render invalidates the shallow-equal check used by
   * `React.memo` and `useMemo` consumers, so any downstream memoization keyed
   * on that prop is wasted.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-object-as-prop.md
   */
  "react-perf/jsx-no-new-object-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject JSX expressions and fragments passed as a JSX prop — each evaluation
   * creates a new React element.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-jsx-as-prop.md
   */
  "react-perf/jsx-no-jsx-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;
}
