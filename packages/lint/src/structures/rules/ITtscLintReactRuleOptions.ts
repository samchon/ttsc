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
 * @evidence contracts/common.md#principled-implementation HOC and export-name lists configure syntactic export exceptions; separate booleans control constant-expression forms and JavaScript scanning without proving runtime refresh safety.
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
   * Export names exempted by caller policy, such as framework route metadata.
   * The rule does not verify that the active framework handles them at
   * runtime.
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
   * Also scan `.js` files that import React. `.tsx` and `.jsx` files are
   * eligible without this switch; names containing `.test.`, `.spec.`, `.cy.`,
   * or `.stories.` remain excluded for every supported extension.
   *
   * @default false
   */
  checkJS?: boolean;
}
