/**
 * Options shapes for the configurable rules in
 * {@link ITtscLintReactRules}.
 *
 * Currently only `react/only-export-components` (from
 * `eslint-plugin-react-refresh`) accepts options.
 *
 * @reference https://github.com/ArnaudBarre/eslint-plugin-react-refresh
 */

/** `react/only-export-components` rule options. */
export interface ITtscLintReactOnlyExportComponentsRuleOptions {
  /**
   * Extra higher-order component names that wrap component exports.
   *
   * @default []
   */
  extraHOCs?: readonly string[];

  /**
   * Export names the active framework handles during refresh, such as
   * route metadata exports.
   *
   * @default []
   */
  allowExportNames?: readonly string[];

  /**
   * Permit literal / string / boolean / template / binary constant
   * exports alongside component exports.
   *
   * @default false
   */
  allowConstantExport?: boolean;

  /**
   * Also scan JavaScript files that import React. TSX files are always
   * scanned.
   *
   * @default false
   */
  checkJS?: boolean;
}
