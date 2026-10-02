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
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintStorybookNoUninstalledAddonsRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintStorybookNoUninstalledAddonsRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintStorybookNoUninstalledAddonsRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintStorybookNoUninstalledAddonsRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintStorybookNoUninstalledAddonsRuleOptions {
  /**
   * Explicit `package.json` path used to validate configured Storybook addons.
   * When omitted, the rule walks upward from the linted config file.
   */
  packageJsonLocation?: string;

  /**
   * Addon package names to skip when checking installation status.
   *
   * @default [ ]
   */
  ignore?: readonly string[];
}
