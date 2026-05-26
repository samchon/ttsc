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
