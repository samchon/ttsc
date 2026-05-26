package linthost

import "testing"

/**
 * Verifies testing-library prefer-query-matchers: truthiness matchers around queries are rejected.
 *
 * Locks the matcher-name check for `toBeNull`, `toBeTruthy`, and `toBeFalsy`
 * when the `expect` argument is a Testing Library query. These assertions should
 * use jest-dom document matchers instead.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Assert query results with null and truthiness matchers.
 * 3. Assert `prefer-query-matchers` reports each matcher call.
 */
func TestPreferQueryMatchers(t *testing.T) {
  source := `
import { screen } from "@testing-library/react";

function testCase() {
  expect(screen.queryByText("Save")).toBeNull();
  expect(screen.getByText("Ready")).toBeTruthy();
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-query-matchers": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/prefer-query-matchers", Severity: SeverityError, Line: 5},
    {Rule: "testing-library/prefer-query-matchers", Severity: SeverityError, Line: 6},
  })
}
