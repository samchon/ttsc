/**
 * Options shape for rules in {@link ITtscLintStorybookRules} that accept
 * configuration. Only `storybook/no-uninstalled-addons` is configurable.
 *
 * @reference https://github.com/storybookjs/eslint-plugin-storybook
 */

/**
 * `storybook/no-uninstalled-addons` rule options.
 *
 * @evidence contracts/common.md#principled-implementation An optional manifest location overrides upward discovery, and an optional package-name list represents deliberately ignored addons rather than inferred installation state.
 * @evidence contracts/common.md#clear-and-simple-design The object separates where dependencies are read from which addon names are exempt, matching the two caller decisions.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Manifest overrides and ignored names are explicit rule inputs, not hardcoded workspace paths or package-manager mutations.
 * @evidence contracts/common.md#meaningful-documentation Native comments state the omitted-location discovery rule and empty ignore default, keeping independent member explanations visually separated.
 */
export interface ITtscLintStorybookNoUninstalledAddonsRuleOptions {
  /**
   * Explicit `package.json` path used to validate configured Storybook addons.
   * When omitted, the rule walks upward from the linted config file.
   */
  packageJsonLocation?: string;

  /**
   * Exact configured addon strings to skip before package-name normalization,
   * including any preset or register suffix present in the configuration.
   *
   * @default [ ]
   */
  ignore?: readonly string[];
}
