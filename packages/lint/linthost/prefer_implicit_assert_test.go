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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify a document matcher around getBy is reported; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations With implicit assertions configured, getBy already establishes presence.
// @evidence contracts/testing.md#distinguishing-cases The standalone presence query removes the redundant matcher. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestPreferImplicitAssert assertTestingLibraryFindings parses the source as TSX under a virtual component.test.tsx path and runs NewEngineWithResolver over it with only prefer-implicit-assert enabled: the expect(getBy...).toBeInTheDocument() source must yield one exact triple and the standalone getBy source must yield none. No DOM runtime, installed consumer, native build or product child host runs.
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
  assertTestingLibraryFindings(t, "import { screen } from \"@testing-library/react\"; function testCase() { screen.getByText(\"Save\"); }\n", RuleConfig{
    "testing-library/prefer-implicit-assert": SeverityError,
  }, nil)
}
