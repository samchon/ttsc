package linthost

import "testing"

/**
 * Verifies testing-library prefer-explicit-assert: standalone presence queries are rejected.
 *
 * Locks the parent-shape check that distinguishes a bare `getBy*` query from a
 * query used inside an assertion or expression. Standalone queries should not
 * silently act as implicit assertions when this stricter rule is enabled.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Call a `getBy*` query as a standalone statement.
 * 3. Assert `prefer-explicit-assert` reports the query call.
 */
func TestPreferExplicitAssert(t *testing.T) {
  source := `
import { screen } from "@testing-library/react";

function testCase() {
  screen.getByText("Save");
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-explicit-assert": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/prefer-explicit-assert", Severity: SeverityError, Line: 5},
  })
}
