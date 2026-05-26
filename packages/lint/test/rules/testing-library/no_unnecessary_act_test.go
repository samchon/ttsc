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
    {Rule: "testing-library/no-unnecessary-act", Severity: SeverityError, Line: 1},
  })
}
