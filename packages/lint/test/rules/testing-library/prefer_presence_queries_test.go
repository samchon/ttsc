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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify presence with queryBy and absence with getBy both report; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations getBy establishes presence while queryBy permits an absent result for negative assertions.
// @evidence contracts/testing.md#distinguishing-cases The control reverses both query families to match assertion polarity. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestPreferPresenceQueries owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
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
  assertTestingLibraryFindings(t, "import { screen } from \"@testing-library/react\"; function testCase() { expect(screen.getByText(\"Save\")).toBeInTheDocument(); expect(screen.queryByText(\"Cancel\")).not.toBeInTheDocument(); }\n", RuleConfig{
    "testing-library/prefer-presence-queries": SeverityError,
  }, nil)
}
