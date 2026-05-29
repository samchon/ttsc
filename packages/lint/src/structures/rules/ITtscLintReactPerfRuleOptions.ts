/**
 * Shared options shape for every rule in {@link ITtscLintReactPerfRules}.
 *
 * @reference https://github.com/cvazac/eslint-plugin-react-perf
 */

/** `react-perf/*` rule options. */
export interface ITtscLintReactPerfRuleOptions {
  /**
   * Controls which intrinsic JSX element props are ignored.
   *
   * `"all"` ignores every prop on lowercase / native elements such as `div`. An
   * array ignores only those prop names on native elements, for example
   * `["style"]`. Custom components are still checked.
   *
   * @default [ ] (native props are checked)
   */
  nativeAllowList?: "all" | readonly string[];
}
