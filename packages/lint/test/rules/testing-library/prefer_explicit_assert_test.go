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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify a standalone getBy query is reported; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations With explicit assertions configured, getBy throwing is not the desired assertion form.
// @evidence contracts/testing.md#distinguishing-cases Wrapping the same query in a document assertion is accepted. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestPreferExplicitAssert owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
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
  assertTestingLibraryFindings(t, "import { screen } from \"@testing-library/react\"; function testCase() { expect(screen.getByText(\"Save\")).toBeInTheDocument(); }\n", RuleConfig{
    "testing-library/prefer-explicit-assert": SeverityError,
  }, nil)
}
