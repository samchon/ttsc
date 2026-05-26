/**
 * Options shape for rules in {@link ITtscLintStorybookRules} that accept
 * configuration. Only `storybook/no-uninstalled-addons` is configurable.
 *
 * @reference https://github.com/storybookjs/eslint-plugin-storybook
 */

/** `storybook/no-uninstalled-addons` rule options. */
export interface ITtscLintStorybookNoUninstalledAddonsRuleOptions {
  /**
   * Explicit `package.json` path used to validate configured Storybook
   * addons. When omitted, the rule walks upward from the linted config
   * file.
   */
  packageJsonLocation?: string;

  /**
   * Addon package names to skip when checking installation status.
   *
   * @default []
   */
  ignore?: readonly string[];
}
