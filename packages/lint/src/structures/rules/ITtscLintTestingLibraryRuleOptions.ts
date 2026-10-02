/**
 * Options shape for the configurable rules in
 * {@link ITtscLintTestingLibraryRules}. Only
 * `testing-library/consistent-data-testid` accepts options today.
 *
 * @reference https://github.com/testing-library/eslint-plugin-testing-library
 */

/**
 * `testing-library/consistent-data-testid` rule options.
 *
 * @evidence contracts/common.md#principled-implementation A required regex supplies the naming policy, while a string-or-list attribute selector permits one or several test-id attributes under the same policy.
 * @evidence contracts/common.md#clear-and-simple-design Pattern and attribute selection share one object because they define one naming check; filename substitution remains a documented pattern feature.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Test-id names derive from configured patterns and the source basename, not fixture-specific accepted values.
 * @evidence contracts/common.md#meaningful-documentation Members explain fileName substitution, the required pattern and default attribute, with separate comments and a blank prose-to-tag line.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation ITtscLintTestingLibraryConsistentDataTestIdRuleOptions is a declaration of data shape and performs no filesystem, path or process operation.
 * @evidenceExclude contracts/performance.md#efficient-algorithms ITtscLintTestingLibraryConsistentDataTestIdRuleOptions is a declaration of data shape and chooses no algorithm or processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work ITtscLintTestingLibraryConsistentDataTestIdRuleOptions is a declaration of data shape and coordinates no computation that could be shared.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources ITtscLintTestingLibraryConsistentDataTestIdRuleOptions is a declaration of data shape; the code that holds its values owns their lifetime.
 */
export interface ITtscLintTestingLibraryConsistentDataTestIdRuleOptions {
  /**
   * Regular expression string every configured test-id attribute value must
   * match. `{fileName}` is replaced with the basename before the first dot.
   */
  testIdPattern: string;

  /**
   * Test-id attribute name, or names, to validate.
   *
   * @default "data-testid"
   */
  testIdAttribute?: string | readonly string[];
}
