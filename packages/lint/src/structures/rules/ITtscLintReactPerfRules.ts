import type { ITtscLintReactPerfRuleOptions } from "./ITtscLintReactPerfRuleOptions";
import type { TtscLintRuleOptionsSetting } from "../TtscLintRuleSetting";

/**
 * React JSX performance rules from `eslint-plugin-react-perf`.
 *
 * Detects freshly-allocated reference values (arrays, objects,
 * functions, JSX elements) passed as JSX props. A new reference
 * invalidates `React.memo` / `useMemo` shallow checks on every
 * render. Useful for performance-critical render paths; usually
 * unnecessary for top-level pages.
 *
 * Diagnostics only fire on `.tsx` source files — JSX heuristics rely
 * on the file extension, so `.ts` files are skipped even when they
 * contain JSX-like syntax.
 *
 * @reference https://github.com/cvazac/eslint-plugin-react-perf
 */
export interface ITtscLintReactPerfRules {
  /**
   * Reject array literals (`[...]`) passed inline as a JSX prop.
   * Hoist the array outside the render or stabilize it with
   * `useMemo`.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-array-as-prop.md
   */
  "react-perf/jsx-no-new-array-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject inline `function` expressions / arrow functions passed
   * as a JSX prop. Stabilize with `useCallback`.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-function-as-prop.md
   */
  "react-perf/jsx-no-new-function-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject inline object literals (`{...}`) passed as a JSX prop.
   *
   * A fresh object on every render invalidates the shallow-equal
   * check used by `React.memo` and `useMemo` consumers, so any
   * downstream memoization keyed on that prop is wasted.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-new-object-as-prop.md
   */
  "react-perf/jsx-no-new-object-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;

  /**
   * Reject JSX expressions and fragments passed as a JSX prop —
   * each evaluation creates a new React element.
   *
   * @reference https://github.com/cvazac/eslint-plugin-react-perf/blob/master/docs/rules/jsx-no-jsx-as-prop.md
   */
  "react-perf/jsx-no-jsx-as-prop"?: TtscLintRuleOptionsSetting<ITtscLintReactPerfRuleOptions>;
}
