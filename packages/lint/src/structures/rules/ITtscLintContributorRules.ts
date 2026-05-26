import type { TtscLintSeverity } from "../TtscLintSeverity";
import type { TtscLintRuleSetting } from "../TtscLintRuleSetting";

/**
 * Catch-all index signature for contributor plugin rules.
 *
 * Plugin authors expose rules under their own namespace prefix
 * (`demo/no-demo`, `myplugin/foo-bar`). The signature here
 * accepts any `"<namespace>/<rule>"` key with either the bare
 * severity form, the severity tuple, or the
 * severity-plus-options tuple. Plugins ship their own typings to
 * tighten the options shape per rule.
 *
 * @reference https://ttsc.dev/lint/development/rules
 */
export interface ITtscLintContributorRules {
  [ruleName: `${string}/${string}`]:
    | TtscLintRuleSetting
    | readonly [TtscLintSeverity, unknown]
    | undefined;
}
