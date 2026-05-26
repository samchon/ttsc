package linthost

import "testing"

/**
 * Verifies testing-library prefer-presence-queries: presence and absence use matching query families.
 *
 * Locks both branches of the matcher rule: positive presence should use
 * `getBy*`, while negated absence should use `queryBy*`. The test provides
 * direct diagnostics instead of only proving malformed expects do not panic.
 *
 * 1. Import `screen` from Testing Library.
 * 2. Assert presence with `queryBy*` and absence with `getBy*`.
 * 3. Assert `prefer-presence-queries` reports both query arguments.
 */
func TestPreferPresenceQueries(t *testing.T) {
  source := `
import { screen } from "@testing-library/react";

function testCase() {
  expect(screen.queryByText("Save")).toBeInTheDocument();
  expect(screen.getByText("Cancel")).not.toBeInTheDocument();
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-presence-queries": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/prefer-presence-queries", Severity: SeverityError, Line: 5},
    {Rule: "testing-library/prefer-presence-queries", Severity: SeverityError, Line: 6},
  })
}
