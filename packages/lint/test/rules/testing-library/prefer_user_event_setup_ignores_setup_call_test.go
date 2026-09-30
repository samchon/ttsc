package linthost

import "testing"

/**
 * Verifies testing-library prefer-user-event-setup: setup calls are not reported.
 *
 * Locks the distinction between creating a user-event instance and invoking an
 * interaction method. The rule should ask direct event calls to use the setup
 * result, not flag the `userEvent.setup()` call that creates that result.
 *
 * 1. Import the default user-event object.
 * 2. Call `userEvent.setup()`, then mix a direct user-event call with a setup-result call.
 * 3. Assert only the direct interaction is reported.
 */
//
// @evidence contracts/testing.md#behavioral-verification The owning engine and Testing Library assertion helpers verify only the direct userEvent.click reports while setup and user.click remain clean; exact normalized findings reject extra or missing results.
// @evidence contracts/testing.md#independent-expectations setup creates the supported interaction instance; creating it is not an event operation.
// @evidence contracts/testing.md#distinguishing-cases The same source contains setup creation, direct interaction and setup-result interaction, separating all three shapes.
// @evidence contracts/testing.md#execution-ownership TestPreferUserEventSetupIgnoresSetupCall owns these variants as a named Go unit entry; actual parsing/engine or registry operations execute in the shared Go process, without a DOM runtime, installed consumer or product child host.
func TestPreferUserEventSetupIgnoresSetupCall(t *testing.T) {
  source := `
import userEvent from "@testing-library/user-event";

function testCase() {
  const user = userEvent.setup();
  userEvent.setup();
  userEvent.click(document.body);
  user.click(document.body);
}
`
  assertTestingLibraryFindings(t, source, RuleConfig{
    "testing-library/prefer-user-event-setup": SeverityError,
  }, []ruleExpectation{
    {Rule: "testing-library/prefer-user-event-setup", Severity: SeverityError, Line: 7},
  })
}
