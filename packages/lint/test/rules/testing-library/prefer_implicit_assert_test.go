package linthost

import "testing"

/**
 * Verifies testing-library prefer-implicit-assert: redundant document assertions are rejected.
 *
 * Locks the matcher-path check from `toBeInTheDocument()` back to the wrapped
 * `expect` argument. A `getBy*` query already asserts presence, so the explicit
 * document matcher should be reported when this rule is enabled.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Assert `toBeInTheDocument()` around a `getBy*` query.
 * 3. Assert `prefer-implicit-assert` reports the matcher call.
 */
func TestPreferImplicitAssert(t *testing.T) {
  source := `
import { screen } from "@testing-library/react";

function testCase() {
  expect(screen.getByText("Save")).toBeInTheDocument();
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-implicit-assert": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/prefer-implicit-assert", Severity: SeverityError, Line: 5},
  })
}
