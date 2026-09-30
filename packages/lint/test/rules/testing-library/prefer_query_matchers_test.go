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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify query assertions using toBeNull/toBeTruthy report; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations Document matchers state presence or absence instead of generic truthiness.
// @evidence contracts/testing.md#distinguishing-cases The accepted source uses explicit document matchers for both polarities. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestPreferQueryMatchers owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
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
  assertTestingLibraryFindings(t, "import { screen } from \"@testing-library/react\"; function testCase() { expect(screen.queryByText(\"Save\")).not.toBeInTheDocument(); expect(screen.getByText(\"Ready\")).toBeInTheDocument(); }\n", RuleConfig{
    "testing-library/prefer-query-matchers": SeverityError,
  }, nil)
}
