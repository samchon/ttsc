package linthost

import "testing"

/**
 * Verifies testing-library prefer-query-by-disappearance: disappearance waits use `queryBy*`.
 *
 * Locks the `waitFor` callback scan for negated document assertions around
 * `getBy*` queries. Waiting for disappearance with `getBy*` can throw before
 * the matcher runs, so the rule should report the enclosing wait.
 *
 * 1. Import `screen` and `waitFor` from Testing Library.
 * 2. Wait for a negated `toBeInTheDocument()` assertion around `getBy*`.
 * 3. Assert `prefer-query-by-disappearance` reports the `waitFor` call.
 */
func TestPreferQueryByDisappearance(t *testing.T) {
  source := `
import { screen, waitFor } from "@testing-library/react";

async function testCase() {
  await waitFor(() => expect(screen.getByText("Saved")).not.toBeInTheDocument());
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-query-by-disappearance": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/prefer-query-by-disappearance", Severity: SeverityError, Line: 5},
  })
}
