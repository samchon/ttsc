import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";
import type { TtscLintSeverity } from "../TtscLintSeverity";

/**
 * Catch-all index signature for contributor plugin rules.
 *
 * Plugin authors expose rules under their own namespace prefix (`demo/no-demo`,
 * `myplugin/foo-bar`). The signature here accepts any `"<namespace>/<rule>"`
 * key with either the bare severity form, the severity tuple, or the
 * severity-plus-options tuple. A plugin tightens its rules by publishing an
 * ordinary exported interface that maps each rule name to its options object,
 * or to `void` for a severity-only rule; the user passes it as the generic
 * argument of `ITtscLintConfig`, and the resulting
 * {@link TtscLintContributorOverlay} intersected into `rules` supersedes this
 * `unknown` fallback for the listed keys:
 *
 * ```ts
 * export interface IDemoLintRules {
 *   "demo/no-marker-comment": { markers?: readonly string[] };
 *   "demo/capitalize-exports": void;
 * }
 *
 * export default {
 *   rules: { "demo/capitalize-exports": "warning" },
 * } satisfies ITtscLintConfig<IDemoLintRules>;
 * ```
 *
 * Contributor namespaces that are not passed to the generic retain the
 * compatible `unknown` options slot.
 *
 * @reference https://ttsc.dev/lint/development/rules
 *
 * @evidence contracts/common.md#principled-implementation The template-literal index accepts namespaced contributor rules and unknown options for every name that no contributor interface passed to the config generic lists.
 * @evidence contracts/common.md#clear-and-simple-design One open interface keeps unlisted contributor names accepted while sharing the existing severity setting type.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The fallback is a documented contributor compatibility boundary, not a built-in rule validation bypass.
 * @evidence contracts/common.md#meaningful-documentation Native prose and an exported-interface example explain typed contributor rules and the unknown fallback; paragraph and tag boundaries follow documentation guidance.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintContributorRules is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintContributorRules is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintContributorRules is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintContributorRules is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintContributorRules {
  [ruleName: `${string}/${string}`]:
    | TtscLintRuleSetting
    | readonly [TtscLintSeverity, unknown]
    | undefined;
}
