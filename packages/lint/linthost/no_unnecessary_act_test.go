package linthost

import "testing"

/**
 * Verifies testing-library no-unnecessary-act: wrapped Testing Library updates are rejected.
 *
 * Locks the `act()` callback scan for calls that Testing Library already wraps.
 * Without this positive case, the rule could stop recognizing `fireEvent`
 * inside `act()` while still appearing registered.
 *
 * 1. Import `act`, `fireEvent`, and `screen` from Testing Library.
 * 2. Wrap a `fireEvent.click` call in `act()`.
 * 3. Assert `no-unnecessary-act` reports the `act` call.
 */
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify act wrapping fireEvent is reported; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations Testing Library event updates already own their act boundary.
// @evidence contracts/testing.md#distinguishing-cases Calling the event without the redundant wrapper is accepted. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestNoUnnecessaryAct assertTestingLibraryFindings parses the source as TSX under a virtual component.test.tsx path and runs NewEngineWithResolver over it with only no-unnecessary-act enabled: the act-wrapped fireEvent source must yield one exact triple and the unwrapped fireEvent source must yield none. No DOM runtime, installed consumer, native build or product child host runs.
func TestNoUnnecessaryAct(t *testing.T) {
  source := `
import { act, fireEvent, screen } from "@testing-library/react";

function testCase() {
  act(() => {
    fireEvent.click(screen.getByRole("button"));
  });
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/no-unnecessary-act": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/no-unnecessary-act", Severity: SeverityError, Line: 5},
  })
  assertTestingLibraryFindings(t, "import { fireEvent, screen } from \"@testing-library/react\"; function testCase() { fireEvent.click(screen.getByRole(\"button\")); }\n", RuleConfig{
    "testing-library/no-unnecessary-act": SeverityError,
  }, nil)
}
