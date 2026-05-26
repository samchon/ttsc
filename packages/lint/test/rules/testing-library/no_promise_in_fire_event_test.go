package linthost

import "testing"

/**
 * Verifies testing-library no-promise-in-fire-event: async helpers are rejected as event targets.
 *
 * Locks the `fireEvent` argument traversal that catches nested Promises without
 * type information. A regression here would let an awaited `findBy*` result be
 * passed directly to a synchronous event helper.
 *
 * 1. Import `fireEvent` and `screen` from Testing Library.
 * 2. Pass an awaited `findBy*` query into `fireEvent.click`.
 * 3. Assert `no-promise-in-fire-event` reports the `fireEvent` call.
 */
func TestNoPromiseInFireEvent(t *testing.T) {
  source := `
import { fireEvent, screen } from "@testing-library/react";

async function testCase() {
  fireEvent.click(await screen.findByRole("button"));
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/no-promise-in-fire-event": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/no-promise-in-fire-event", Severity: SeverityError, Line: 5},
  })
}
