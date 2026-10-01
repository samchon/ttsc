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
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify fireEvent with an awaited findBy target is reported; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations The supported rule disallows async-query expressions nested in event-helper arguments.
// @evidence contracts/testing.md#distinguishing-cases A synchronous getBy target removes the nested async-query shape. The original violations remain intact and the authored adjacent source is asserted clean.
// @evidence contracts/testing.md#execution-ownership TestNoPromiseInFireEvent assertTestingLibraryFindings parses the source as TSX under a virtual component.test.tsx path and runs NewEngineWithResolver over it with only no-promise-in-fire-event enabled: the awaited-findBy source must yield one exact triple and the getBy-target source in the second call must yield none. No DOM runtime, installed consumer, native build or product child host runs.
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
  assertTestingLibraryFindings(t, "import { fireEvent, screen } from \"@testing-library/react\"; function testCase() { fireEvent.click(screen.getByRole(\"button\")); }\n", RuleConfig{
    "testing-library/no-promise-in-fire-event": SeverityError,
  }, nil)
}
