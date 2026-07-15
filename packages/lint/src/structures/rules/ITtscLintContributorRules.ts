import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";
import type { TtscLintSeverity } from "../TtscLintSeverity";

/**
 * Catch-all index signature for contributor plugin rules.
 *
 * Plugin authors expose rules under their own namespace prefix (`demo/no-demo`,
 * `myplugin/foo-bar`). The signature here accepts any `"<namespace>/<rule>"`
 * key with either the bare severity form, the severity tuple, or the
 * severity-plus-options tuple. Plugins tighten a known rule by augmenting
 * `ITtscLintRuleOptionsMap`; the mapped overlay intersected into
 * `ITtscLintRules` then supersedes this `unknown` fallback for that key. An
 * optionless contributor augments this interface directly with
 * `TtscLintRuleSetting` instead:
 *
 * ```ts
 * import type { TtscLintRuleSetting } from "@ttsc/lint";
 *
 * declare module "@ttsc/lint" {
 *   interface ITtscLintContributorRules {
 *     "demo/no-options"?: TtscLintRuleSetting;
 *   }
 * }
 * ```
 *
 * Contributor namespaces with no imported augmentation retain the compatible
 * `unknown` options slot.
 *
 * @reference https://ttsc.dev/lint/development/rules
 */
export interface ITtscLintContributorRules {
  [ruleName: `${string}/${string}`]:
    | TtscLintRuleSetting
    | readonly [TtscLintSeverity, unknown]
    | undefined;
}
