import type {
  ITtscLintDisableEnablePairRuleOptions,
  ITtscLintNoRestrictedDisableRuleOptions,
  ITtscLintNoUseRuleOptions,
} from "./ITtscLintEslintCommentsRuleOptions";
import type {
  TtscLintRuleOptionsSetting,
  TtscLintRuleSetting,
} from "../TtscLintRuleSetting";

/**
 * Hygiene rules for lint-directive comments such as
 * `// eslint-disable-next-line`, `/* eslint-disable * /`, and
 * `// eslint-enable`.
 *
 * `@ttsc/lint` accepts both `eslint-*` and the equivalent
 * `ttsc-lint-*` directive comments; these rules operate on either
 * spelling and report stale, over-broad, or otherwise unhealthy
 * suppressions.
 *
 * @reference https://github.com/eslint-community/eslint-plugin-eslint-comments
 */
export interface ITtscLintEslintCommentsRules {
  /**
   * Require range `eslint-disable` block directives to be terminated
   * by a matching `eslint-enable`, so file-scope suppressions cannot
   * drift forever.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/disable-enable-pair.html
   */
  "eslint-comments/disable-enable-pair"?: TtscLintRuleOptionsSetting<ITtscLintDisableEnablePairRuleOptions>;

  /**
   * Reject bare `eslint-enable` comments that re-enable every
   * previously disabled rule at once — the resulting scope is
   * impossible to reason about.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-aggregating-enable.html
   */
  "eslint-comments/no-aggregating-enable"?: TtscLintRuleSetting;

  /**
   * Reject `eslint-disable` directives that disable a rule already
   * disabled at the position in question.
   *
   * The duplicate is dead code, usually meaning a maintainer added a
   * fresh suppression without noticing the existing one above.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-duplicate-disable.html
   */
  "eslint-comments/no-duplicate-disable"?: TtscLintRuleSetting;

  /**
   * Reject `eslint-disable` directives that target the rules listed
   * in the rule options — usually used to forbid suppressing
   * project-critical rules like `typescript/no-explicit-any`.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-restricted-disable.html
   */
  "eslint-comments/no-restricted-disable"?: TtscLintRuleOptionsSetting<ITtscLintNoRestrictedDisableRuleOptions>;

  /**
   * Reject `eslint-disable` directives without an explicit rule
   * list.
   *
   * A blanket disable hides every rule, including ones added after
   * the suppression was written.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-unlimited-disable.html
   */
  "eslint-comments/no-unlimited-disable"?: TtscLintRuleSetting;

  /**
   * Reject `eslint-disable` directives that suppress no current
   * diagnostic — stale suppressions left over from past refactors.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-unused-disable.html
   */
  "eslint-comments/no-unused-disable"?: TtscLintRuleSetting;

  /**
   * Reject `eslint-enable` directives that re-enable nothing —
   * either no `eslint-disable` is active at that point or the
   * targeted rule was never disabled there.
   *
   * Dead code that misleads readers about the suppression scope.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-unused-enable.html
   */
  "eslint-comments/no-unused-enable"?: TtscLintRuleSetting;

  /**
   * Reject inline lint directive comments altogether, optionally
   * allowing specific kinds.
   *
   * Use when a project wants to forbid suppressions and force fixes
   * at the source.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/no-use.html
   */
  "eslint-comments/no-use"?: TtscLintRuleOptionsSetting<ITtscLintNoUseRuleOptions>;

  /**
   * Require a `--` description on every lint directive comment so
   * the suppression carries a rationale for future readers.
   *
   * @reference https://eslint-community.github.io/eslint-plugin-eslint-comments/rules/require-description.html
   */
  "eslint-comments/require-description"?: TtscLintRuleSetting;
}
