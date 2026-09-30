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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify waitFor with negated getBy presence is reported; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations A disappearance check needs a query that can return absence without throwing.
// @evidence contracts/testing.md#distinguishing-cases The same wait using queryBy is accepted. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestPreferQueryByDisappearance owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
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
  assertTestingLibraryFindings(t, "import { screen, waitFor } from \"@testing-library/react\"; async function testCase() { await waitFor(() => expect(screen.queryByText(\"Saved\")).not.toBeInTheDocument()); }\n", RuleConfig{
    "testing-library/prefer-query-by-disappearance": SeverityError,
  }, nil)
}
