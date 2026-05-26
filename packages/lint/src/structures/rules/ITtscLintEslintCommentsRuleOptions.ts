/**
 * Options shapes for the configurable rules in
 * {@link ITtscLintEslintCommentsRules}.
 *
 * @reference https://github.com/eslint-community/eslint-plugin-eslint-comments
 */

/** `eslint-comments/disable-enable-pair` rule options. */
export interface ITtscLintDisableEnablePairRuleOptions {
  /**
   * Allow a file-leading range disable to stay open through the end of
   * the file.
   *
   * @default false
   */
  allowWholeFile?: boolean;
}

/** `eslint-comments/no-restricted-disable` rule options. */
export interface ITtscLintNoRestrictedDisableRuleOptions {
  /** Rule names that inline disable comments may not suppress. */
  rules?: readonly string[];
}

/** `eslint-comments/no-use` rule options. */
export interface ITtscLintNoUseRuleOptions {
  /**
   * Directive markers that remain allowed, such as
   * `"eslint-disable-next-line"`.
   *
   * @default []
   */
  allow?: readonly string[];
}
