/**
 * Shared options shape for every rule in {@link ITtscLintReactPerfRules}.
 *
 * @reference https://github.com/cvazac/eslint-plugin-react-perf
 */

/**
 * `react-perf/*` rule options.
 *
 * @evidence contracts/common.md#principled-implementation The all discriminant exempts every intrinsic prop while a readonly name list exempts only selected props; custom components remain outside either exemption.
 * @evidence contracts/common.md#clear-and-simple-design One shared allowance shape serves all React allocation rules because their intrinsic-element filtering decision is identical.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Prop exemptions are explicit config values consumed by native JSX analysis, without patching React or inserting measurement-only component paths.
 * @evidence contracts/common.md#meaningful-documentation The member contrasts all and named allowances, gives a style example, states custom-component behavior and documents the empty-list default.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintReactPerfRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintReactPerfRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintReactPerfRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintReactPerfRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
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
