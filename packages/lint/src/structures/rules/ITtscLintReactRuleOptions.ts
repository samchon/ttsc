/**
 * Options shapes for the configurable rules in {@link ITtscLintReactRules}.
 *
 * Currently only `react/only-export-components` (from
 * `eslint-plugin-react-refresh`) accepts options.
 *
 * @reference https://github.com/ArnaudBarre/eslint-plugin-react-refresh
 */

/**
 * `react/only-export-components` rule options.
 *
 * @evidence contracts/common.md#principled-implementation HOC and export-name lists identify refresh-safe exports; separate booleans control literal constants and JavaScript scanning without changing component identity.
 * @evidence contracts/common.md#clear-and-simple-design One option object keeps export exceptions beside the source-file scan switch for the refresh rule that consumes them.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Framework exceptions are explicit caller configuration, rather than hardcoded project names or patched React internals.
 * @evidence contracts/common.md#meaningful-documentation Member comments identify refresh-handled exports, constant categories, JavaScript opt-in and defaults; separated comments follow documentation guidance.
 */
export interface ITtscLintReactOnlyExportComponentsRuleOptions {
  /**
   * Extra higher-order component names that wrap component exports.
   *
   * @default [ ]
   */
  extraHOCs?: readonly string[];

  /**
   * Export names the active framework handles during refresh, such as route
   * metadata exports.
   *
   * @default [ ]
   */
  allowExportNames?: readonly string[];

  /**
   * Permit literal / string / boolean / template / binary constant exports
   * alongside component exports.
   *
   * @default false
   */
  allowConstantExport?: boolean;

  /**
   * Also scan JavaScript files that import React. TSX files are always scanned.
   *
   * @default false
   */
  checkJS?: boolean;
}
