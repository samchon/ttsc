/**
 * Options shape for the configurable rules in
 * {@link ITtscLintTestingLibraryRules}. Only
 * `testing-library/consistent-data-testid` accepts options today.
 *
 * @reference https://github.com/testing-library/eslint-plugin-testing-library
 */

/** `testing-library/consistent-data-testid` rule options. */
export interface ITtscLintTestingLibraryConsistentDataTestIdRuleOptions {
  /**
   * Regular expression string every configured test-id attribute value
   * must match. `{fileName}` is replaced with the basename before the
   * first dot.
   */
  testIdPattern: string;

  /**
   * Test-id attribute name, or names, to validate.
   *
   * @default "data-testid"
   */
  testIdAttribute?: string | readonly string[];
}
